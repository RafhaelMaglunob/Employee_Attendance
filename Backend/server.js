// server.js
import Fastify from "fastify";
import cors from "@fastify/cors"
import 'dotenv/config'
import bcrypt from 'bcrypt'
import { pool } from './db/pool.js';
import { createEmployeesTable } from "./db/employee.js";
import { createArchiveTable } from "./db/archive.js";

import { initEmployeeDeletionSchedules } from "./utils/employeeDeletionScheduler.js";

import { employeeRoutes } from "./routes/employeeRoute.js";
import { archiveRoutes } from "./routes/archiveRoute.js";
import { logRoutes } from "./routes/logRoute.js";
import { attendanceRoutes } from "./routes/attendanceRoute.js";
import { adminAccountRoutes } from "./routes/adminAccountRoute.js";
import { employeeAccountRoutes } from "./routes/employeeAccountRoute.js";

const fastify = Fastify();

await fastify.register(cors, {
  origin: [
    process.env.FRONTEND_URL, 
    process.env.FRONTEND_URL2,
    process.env.FRONTEND_URL3
  ],
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
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
fastify.register( employeeAccountRoutes, {prefix: "/api"})

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

