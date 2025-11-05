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

import { initEmployeeDeletionSchedules } from "./utils/employeeDeletionScheduler.js";
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

const fastify = Fastify();
const io = initSocket(fastify.server);

const port = new SerialPort({
  path: 'COM3',
  baudRate: 9600
});

port.on('open', () => {
  console.log('✅ Serial port open and ready');
});

const parser = port.pipe(new ReadlineParser({ delimiter: '\n' }));
let enrollmentStatus = {};

// Listen to Arduino messages
parser.on('data', (data) => {
  console.log('Arduino:', data);
  
  // Parse enrollment progress messages
  if (data.includes('Place finger')) {
    enrollmentStatus.message = 'Place your finger on the sensor';
  } else if (data.includes('Remove finger')) {
    enrollmentStatus.message = 'Remove your finger';
  } else if (data.includes('Place same finger again')) {
    enrollmentStatus.message = 'Place the same finger again';
  } else if (data.includes('Prints matched')) {
    enrollmentStatus.message = 'Fingerprint matched! Saving...';
  } else if (data.includes('Stored!')) {
    enrollmentStatus.status = 'complete';
    enrollmentStatus.message = 'Registration complete!';
  } else if (data.includes('Error')) {
    enrollmentStatus.status = 'error';
    enrollmentStatus.message = 'Enrollment failed. Please try again.';
  }
});

fastify.decorate("pg", pool)
fastify.decorate("io", io);
fastify.decorate("port", port);
fastify.decorate("enrollmentStatus", enrollmentStatus);

fastify.register(fastifyJwt, {
  secret: "yourSuperSecretKeyHere",
});

fastify.decorate("authenticate", async function (req, reply) {
  try {
    await req.jwtVerify();
  } catch (err) {
    return reply.status(401).send({ error: "Invalid or expired token" });
  }
});

await fastify.register(cors, {
  origin: [
    process.env.FRONTEND_URL, 
    process.env.FRONTEND_URL2,
    process.env.FRONTEND_URL3
  ],
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  credentials: true
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

// Test route
fastify.get("/", async (req, res) => {
  return { message: "🚀 Server is running!" };
});

fastify.register( employeeRoutes, {prefix: "/api", io} )
fastify.register( archiveRoutes, {prefix: "/api", io} )
fastify.register( logRoutes, {prefix: "/api", io} )
fastify.register( attendanceRoutes, {prefix: "/api", io} )
fastify.register( adminAccountRoutes, {prefix: "/api", io} )
fastify.register( employeeAccountRoutes, {prefix: "/api", io})
fastify.register( scheduleRoutes, {prefix: "/api", io})
fastify.register( incidentRoutes, {prefix: "/api", io})
fastify.register( fingerprintRoutes, { prefix: "/api", io });

await initEmployeeDeletionSchedules(pool)
  .then(() => console.log('✅ Employee deletion scheduler started'))
  .catch(err => console.error('❌ Failed to start scheduler', err));
    
fastify.listen({ port: Number(process.env.PORT), host: '0.0.0.0' }, (err, address) => {
  if (err) {
    console.error(err);
    process.exit(1);
  }
  console.log(`🚀 Server running at ${address}`);
});

