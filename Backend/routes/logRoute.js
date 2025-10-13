import { logController } from "../controllers/logController.js";

export async function logRoutes(fastify, options) {
    const controller = logController(fastify.pg);

    fastify.get("/audit", controller.getAllAuditLogs)
}
