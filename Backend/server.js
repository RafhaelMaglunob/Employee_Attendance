// server.js
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

const fastify = Fastify();
const io = initSocket(fastify.server);

fastify.decorate("pg", pool)
fastify.decorate("io", io);

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

