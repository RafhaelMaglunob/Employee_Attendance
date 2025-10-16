// server.js
import Fastify from "fastify";
import pkg from "pg";
import cors from "@fastify/cors"
import 'dotenv/config'
import bcrypt from 'bcrypt'

import cron from 'node-cron'
import { google } from "googleapis";

import { createEmployeesTable } from "./db/employee.js";
import { createArchiveTable } from "./db/archive.js";

import { employeeRoutes } from "./routes/employeeRoute.js";
import { archiveRoutes } from "./routes/archiveRoute.js";
import { logRoutes } from "./routes/logRoute.js";
import { attendanceRoutes } from "./routes/attendanceRoute.js";
import { adminAccountRoutes } from "./routes/adminAccountRoute.js";

const { Pool } = pkg;
const fastify = Fastify();


const auth = new google.auth.GoogleAuth({
  scopes: ["https://www.googleapis.com/auth/drive.readonly"],
});

const drive = google.drive({ version: "v3", auth });

// ✅ PostgreSQL connection pool
const pool = new Pool({
  user: process.env.PG_USER,
  host: process.env.PG_HOST,
  database: process.env.PG_DATABASE,
  password: process.env.PG_PASSWORD,
  port: Number(process.env.PG_PORT),
});

await fastify.register(cors, {
  origin: [
    process.env.FRONTEND_URL, 
    process.env.FRONTEND_URL2,
    process.env.FRONTEND_URL3
  ],
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  credentials: true
});

fastify.decorate("pg", pool)

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

fastify.register( employeeRoutes, {prefix: "/api"} )
fastify.register( archiveRoutes, {prefix: "/api"} )
fastify.register( logRoutes, {prefix: "/api"} )
fastify.register( attendanceRoutes, {prefix: "/api"} )
fastify.register( adminAccountRoutes, {prefix: "/api"} )

cron.schedule('* * * * *', async () => { // runs every day at midnight
    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // 1. Get employees whose effective_deletion_date <= today
        const { rows: employeesToDelete } = await client.query(`
            SELECT * FROM employees
            WHERE effective_deletion_date IS NOT NULL
              AND effective_deletion_date <= CURRENT_DATE
        `);

        if (employeesToDelete.length === 0) {
            console.log('No employees to archive/delete today.');
            await client.query('COMMIT');
            return;
        }

        for (const emp of employeesToDelete) {
            const id = emp.employee_id;

            // Archive employee
            await client.query(`
                INSERT INTO employees_archive (
                    employee_id, fullname, nickname, email, position, employment_type, status, gender, contact,
                    birthday, marital_status, address, sss_number, pagibig, philhealth
                )
                SELECT employee_id, fullname, nickname, email, position, employment_type, status, gender, contact,
                    birthday, marital_status, address, sss_number, pagibig, philhealth
                FROM employees
                WHERE employee_id = $1
                ON CONFLICT (employee_id) DO NOTHING
            `, [id]);

            // Archive dependents
            await client.query(`
                INSERT INTO employee_dependents_archive (
                    employee_id, fullname, relationship, address, contact, city, postalcode, gcash_number
                )
                SELECT employee_id, fullname, relationship, address, contact, city, postalcode, gcash_number
                FROM employee_dependents
                WHERE employee_id = $1
            `, [id]);

            // Archive documents
            await client.query(`
                INSERT INTO employee_documents_archive (
                    document_id, employee_id, sss_id, resume_cv, pagibig, philhealth, barangay_clearance
                )
                SELECT document_id, employee_id, sss_id, resume_cv, pagibig, philhealth, barangay_clearance
                FROM employee_documents
                WHERE employee_id = $1
            `, [id]);
        }

        // 2. Delete employees and related data
        await client.query(`
            DELETE FROM employee_documents WHERE employee_id IN (
                SELECT employee_id FROM employees WHERE effective_deletion_date <= CURRENT_DATE
            );
        `);

        await client.query(`
            DELETE FROM employee_dependents WHERE employee_id IN (
                SELECT employee_id FROM employees WHERE effective_deletion_date <= CURRENT_DATE
            );
        `);

        const { rows: deleted } = await client.query(`
            DELETE FROM employees
            WHERE effective_deletion_date IS NOT NULL
              AND effective_deletion_date <= CURRENT_DATE
            RETURNING employee_id;
        `);

        await client.query('COMMIT');

        console.log(`Archived and deleted employees: ${deleted.map(d => d.employee_id).join(', ')}`);
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('Failed to archive/delete employees:', err);
    } finally {
        client.release();
    }
});

fastify.listen({ port: Number(process.env.PORT), host: '0.0.0.0' }, (err, address) => {
  if (err) {
    console.error(err);
    process.exit(1);
  }
  console.log(`🚀 Server running at ${address}`);
});

