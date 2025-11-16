import { SerialPort } from "serialport";
import { ReadlineParser } from "@serialport/parser-readline"

import Fastify from "fastify";
import fastifyJwt from "@fastify/jwt";
import cors from "@fastify/cors"
import 'dotenv/config'
import { pool } from './db/pool.js';
import { initSocket } from './socket.js';
import { createEmployeesTable } from "./db/employee.js";
import { createArchiveTable } from "./db/archive.js";
import argon2 from "argon2";

import fastifyStatic from '@fastify/static';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

import { initEmployeeDeletionSchedules } from "./utils/employeeDeletionScheduler.js";
import { initEmployeeRestorationSchedules } from "./utils/EmployeeRestoreScheduler.js";
import { initLeaveReturnCatchUp } from "./utils/employeeLeaveSchedule.js";

import "./utils/scheduler.js";

import { employeeRoutes } from "./routes/employeeRoute.js";
import { archiveRoutes } from "./routes/archiveRoute.js";
import { logRoutes } from "./routes/logRoute.js";
import { attendanceRoutes } from "./routes/attendanceRoute.js";
import { adminAccountRoutes } from "./routes/adminAccountRoute.js";
import { employeeAccountRoutes } from "./routes/employeeAccountRoute.js";
import { scheduleRoutes } from "./routes/scheduleRoute.js";
import { incidentRoutes } from "./routes/incidentRoute.js";
import { fingerprintRoutes } from "./routes/fingerprintRoute.js";
import { forgotPasswordRoutes } from "./routes/forgotPasswordRoute.js";
import { certificateRoutes } from "./routes/certificateRoute.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);


const fastify = Fastify();
const io = initSocket(fastify.server);

const port = new SerialPort({
  path: 'COM3',
  baudRate: 9600
});

port.on('open', () => {
  console.log('✅ Serial port open and ready');
});

port.on('error', (err) => {
  console.error('❌ Serial port error:', err);
});

const parser = port.pipe(new ReadlineParser({ delimiter: '\n' }));
let enrollmentStatus = {};

// Listen to Arduino messages
parser.on('data', async (data) => {
  const message = data.toString().trim();
  console.log('📨 Arduino:', message);

  // === ENROLLMENT MESSAGES ===
  if (message.startsWith('STORE_TEMPLATE:DIGITAL_ONLY:')) {
    const slot = parseInt(message.split(':')[2]);
    if (enrollmentStatus.digitalEnrollCallback) {
      enrollmentStatus.digitalEnrollCallback(true, `Template stored in slot ${slot}`);
      delete enrollmentStatus.digitalEnrollCallback;
    }
  }
  else if (message.startsWith('STORE_TEMPLATE:ERROR:')) {
    const errorMsg = message.substring('STORE_TEMPLATE:ERROR:'.length);
    if (enrollmentStatus.digitalEnrollCallback) {
      enrollmentStatus.digitalEnrollCallback(false, errorMsg);
      delete enrollmentStatus.digitalEnrollCallback;
    }
  }
  if (message.startsWith('ENROLL:')) {
    const parts = message.split(':');
    const status = parts[1];
    
    if (status === 'PLACE_FINGER') {
      enrollmentStatus.message = 'Place your finger on the sensor';
      enrollmentStatus.progress = 'Step 1/4';
    } 
    else if (status === 'FIRST_OK') {
      enrollmentStatus.message = 'First scan complete';
      enrollmentStatus.progress = 'Step 2/4';
    }
    else if (status === 'REMOVE_FINGER') {
      enrollmentStatus.message = 'Remove your finger';
      enrollmentStatus.progress = 'Step 2/4';
    } 
    else if (status === 'PLACE_AGAIN') {
      enrollmentStatus.message = 'Place same finger again';
      enrollmentStatus.progress = 'Step 3/4';
    }
    else if (status === 'SECOND_OK') {
      enrollmentStatus.message = 'Second scan complete';
      enrollmentStatus.progress = 'Step 3/4';
    }
    else if (status === 'CREATING_MODEL') {
      enrollmentStatus.message = 'Creating fingerprint model...';
      enrollmentStatus.progress = 'Step 4/4';
    }
    else if (status === 'STORING') {
      enrollmentStatus.message = 'Storing fingerprint...';
      enrollmentStatus.progress = 'Step 4/4';
    }
    else if (status === 'SUCCESS') {
      enrollmentStatus.status = 'complete';
      enrollmentStatus.message = 'Enrollment successful!';
      enrollmentStatus.progress = 'Complete';
      console.log('✅ Enrollment complete');
    } 
    else if (status === 'ERROR') {
      enrollmentStatus.status = 'error';
      enrollmentStatus.message = parts[2] || 'Enrollment failed';
      console.log('❌ Enrollment error:', enrollmentStatus.message);
    }
  }
  
  // === VALIDATION MESSAGES ===
  else if (message.startsWith('VALIDATE:')) {
    const parts = message.split(':');
    const status = parts[1];
    const slot = parseInt(parts[2]);
    
    console.log(`🔍 Validation result for slot ${slot}: ${status}`);
    
    if (enrollmentStatus.validationSlot === slot && enrollmentStatus.validationCallback) {
      const exists = status === 'EXISTS';
      enrollmentStatus.validationCallback(exists);
      
      delete enrollmentStatus.validationSlot;
      delete enrollmentStatus.validationCallback;
    }
  }
  
  // === SCAN ALL MESSAGES ===
  else if (message.startsWith('SCAN_ALL:')) {
    const parts = message.split(':');
    const action = parts[1];
    
    if (action === 'START') {
      console.log('🔄 Starting full slot scan...');
      enrollmentStatus.scanAllSlots = [];
    }
    else if (action === 'SLOT') {
      const slot = parseInt(parts[2]);
      enrollmentStatus.scanAllSlots.push(slot);
      console.log(`  Found slot: ${slot}`);
    }
    else if (action === 'PROGRESS') {
      console.log(`  Progress: ${parts[2]}`);
    }
    else if (action === 'COMPLETE') {
      const count = parseInt(parts[2]);
      console.log(`✅ Scan complete: ${count} fingerprints found`);
      
      if (enrollmentStatus.syncCheckCallback) {
        enrollmentStatus.syncCheckCallback(enrollmentStatus.scanAllSlots);
        delete enrollmentStatus.syncCheckCallback;
      }
      
      delete enrollmentStatus.scanAllSlots;
    }
  }
  
  // === DELETE SLOT MESSAGES ===
  else if (message.startsWith('DELETE_SLOT:')) {
    const parts = message.split(':');
    const status = parts[1];
    
    if (enrollmentStatus.deleteSlotCallback) {
      if (status === 'SUCCESS') {
        const slot = parseInt(parts[2]);
        console.log(`✅ Hardware slot ${slot} deleted`);
        enrollmentStatus.deleteSlotCallback(true, `Slot ${slot} deleted successfully`);
      } else if (status === 'ERROR') {
        const errorMsg = parts[2] || 'Unknown error';
        console.log(`❌ Failed to delete slot: ${errorMsg}`);
        enrollmentStatus.deleteSlotCallback(false, errorMsg);
      }
      
      delete enrollmentStatus.deleteSlotCallback;
    }
  }
  
  // === ATTENDANCE MESSAGES ===
  else if (message.startsWith('SLOT:')) {
    const slotMatch = message.match(/SLOT:(\d+)/);
    const confMatch = data.toString().match(/CONFIDENCE:(\d+)/);
    
    if (slotMatch) {
      const fingerprintSlot = parseInt(slotMatch[1]);
      const confidence = confMatch ? parseInt(confMatch[1]) : 0;
      
      console.log(`🔔 Attendance: Slot ${fingerprintSlot}, Confidence: ${confidence}`);
      await processAttendance(fingerprintSlot, confidence);
    }
  }
});

async function processAttendance(fingerprintSlot, confidence) {
  const client = await pool.connect();
  try {
    const fingerprintData = await client.query(
      `SELECT ef.employee_id, e.fullname 
       FROM employee_fingerprints ef
       JOIN employees e ON ef.employee_id = e.employee_id
       WHERE ef.fingerprint_slot = $1 AND ef.status = $2`,
      [fingerprintSlot, 'Active']
    );
    
    if (fingerprintData.rows.length === 0) {
      console.log(`❌ Slot ${fingerprintSlot} not registered`);
      return;
    }
    
    const { employee_id, fullname } = fingerprintData.rows[0];
    const currentTime = new Date();
    const currentDate = currentTime.toISOString().split('T')[0];
    const timeString = currentTime.toTimeString().split(' ')[0];
    
    const todayAttendance = await client.query(
      `SELECT * FROM employee_attendance 
       WHERE employee_id = $1 AND attend_date = $2`,
      [employee_id, currentDate]
    );
    
    if (todayAttendance.rows.length === 0) {
      // === CLOCK IN ===
      await client.query(
        `INSERT INTO employee_attendance 
         (employee_id, attend_date, clock_in, clock_out, total_hours, status)
         VALUES ($1, $2, $3, '00:00:00', 0, 'Pending')`,
        [employee_id, currentDate, timeString]
      );
      
      await client.query(
        `INSERT INTO fingerprint_attendance_log 
         (employee_id, fingerprint_slot, clock_type, clock_time, confidence_score)
         VALUES ($1, $2, $3, $4, $5)`,
        [employee_id, fingerprintSlot, 'IN', currentTime, confidence]
      );
      
      console.log(`✅ ${fullname} clocked IN at ${timeString}`);
      
      io.emit('attendance:clock-in', {
        employee_id,
        fullname,
        time: timeString,
        date: currentDate
      });
      
    } else {
      // === CLOCK OUT ===
      const clockInTime = todayAttendance.rows[0].clock_in;
      const clockInDate = new Date(`${currentDate}T${clockInTime}`);
      const hours = ((currentTime - clockInDate) / (1000 * 60 * 60)).toFixed(2);
      
      await client.query(
        `UPDATE employee_attendance 
         SET clock_out = $1, total_hours = $2, status = $3
         WHERE employee_id = $4 AND attend_date = $5`,
        [timeString, hours, 'Present', employee_id, currentDate]
      );
      
      await client.query(
        `INSERT INTO fingerprint_attendance_log 
         (employee_id, fingerprint_slot, clock_type, clock_time, confidence_score)
         VALUES ($1, $2, $3, $4, $5)`,
        [employee_id, fingerprintSlot, 'OUT', currentTime, confidence]
      );
      
      console.log(`✅ ${fullname} clocked OUT at ${timeString} (${hours}h)`);
      
      io.emit('attendance:clock-out', {
        employee_id,
        fullname,
        time: timeString,
        date: currentDate,
        total_hours: hours
      });
    }
    
    await client.query(
      `UPDATE employee_fingerprints 
       SET last_used = CURRENT_TIMESTAMP 
       WHERE fingerprint_slot = $1`,
      [fingerprintSlot]
    );
    
  } catch (error) {
    console.error('❌ Error processing attendance:', error);
  } finally {
    client.release();
  }
}

fastify.decorate("pg", pool)
fastify.decorate("io", io);
fastify.decorate("port", port);
fastify.decorate("enrollmentStatus", enrollmentStatus);

await fastify.register(fastifyStatic, {
  root: join(__dirname, 'certificates'),
  prefix: '/certificates/',
  decorateReply: false // Important: don't override reply.sendFile
});

fastify.register(fastifyJwt, {
  secret: "yourSuperSecretKeyHere",
});



fastify.decorate("authenticate", async function (req, reply) {
  try {
    console.log('🔐 Token to verify:', req.headers.authorization);
    await req.jwtVerify();
    console.log('✅ Token verified successfully');
  } catch (err) {
    console.log('❌ Token verification failed:', err.message);
    return reply.status(401).send({ error: "Invalid or expired token" });
  }
});

await fastify.register(cors, {
  origin: [
    process.env.FRONTEND_URL, 
    process.env.FRONTEND_URL2,
    process.env.FRONTEND_URL3,
    process.env.FRONTEND_URL4
  ],
  credentials: true,  
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS']
});

fastify.get("/setup", async(req, reply) => {
    const client = await pool.connect()
    try{
        await createEmployeesTable(client);
        await createArchiveTable(client);
        reply.send({ message: "✅ Setup complete" });
    } catch(err){
        console.error(err)
        reply.status(500).send({error: "❌ Setup Failed"})
    } finally {
        client.release()
    }
})

fastify.get("/", async (req, res) => {
  return { message: "🚀 Server is running!" };
});

fastify.register( employeeRoutes, {prefix: "/api", io} )
fastify.register( archiveRoutes, {prefix: "/api", io} )
fastify.register( logRoutes, {prefix: "/api", io} )
fastify.register( attendanceRoutes, {prefix: "/api", io} )
fastify.register( adminAccountRoutes, {prefix: "/api"} )
fastify.register( employeeAccountRoutes, {prefix: "/api", io})
fastify.register( scheduleRoutes, {prefix: "/api", io})
fastify.register( incidentRoutes, {prefix: "/api", io})
fastify.register( fingerprintRoutes, { prefix: "/api", io });
fastify.register( forgotPasswordRoutes, { prefix: "/api", io });
fastify.register( certificateRoutes, { prefix: "/api", io });

// ========================================
// STARTUP INITIALIZATION
// ========================================

console.log('⏳ Initializing schedulers...');

// Initialize leave scheduler WITH startup check (runs check on startup)
await initLeaveReturnCatchUp(pool, io)
  .then(() => console.log('✅ Leave scheduler with startup check initialized'))
  .catch(err => console.error('❌ Failed to start leave scheduler', err));

await initEmployeeDeletionSchedules(pool)
  .then(() => console.log('✅ Employee deletion scheduler started'))
  .catch(err => console.error('❌ Failed to start scheduler', err));

await initEmployeeRestorationSchedules(pool)
  .then(() => console.log('✅ Employee restoration scheduler started'))
  .catch(err => console.error('❌ Failed to start scheduler', err));
      
fastify.listen({ port: Number(process.env.PORT), host: '0.0.0.0' }, (err, address) => {
  if (err) {
    console.error(err);
    process.exit(1);
  }
  console.log(`🚀 Server running at ${address}`);
});