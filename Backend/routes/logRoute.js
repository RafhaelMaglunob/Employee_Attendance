import { logController } from "../controllers/logController.js";

export async function logRoutes(fastify, options) {
    const controller = logController(fastify.pg);

    fastify.get("/audit", controller.getAllAuditLogs)
    fastify.get("/work-logs", controller.getAllWorkLogs);
    fastify.get("/total-work-logs", controller.getTotalWorkLogs)
    fastify.get("/work-logs/:id", controller.getSingleWorkLog)
    fastify.get("/employee-pay-periods", controller.getEmployeePayPeriod)
    fastify.get("/incidents", controller.getIncidentLogs)
}
