import { employeeAccountController } from "../controllers/employeeAccountController.js";
import { authMiddleware } from "../middleware/authMiddleware.js";

export function employeeAccountRoutes(fastify, options){
    const io = options.io;
    const controller = employeeAccountController(fastify.pg, io);

    fastify.post("/employee-login", controller.getLoginEmployeeAccount);
    fastify.put("/employee/change-password", { preHandler: authMiddleware}, controller.changeEmployeePassword);
    
    fastify.post("/employee/documents/:id", controller.addEmployeeDocuments);
    fastify.get('/employee/documents/:id', controller.getEmployeeDocuments);
    fastify.get('/employee/documents/:id/completion', controller.getDocumentCompletion);
    fastify.patch('/employee/documents/:documentId', controller.deleteEmployeeDocument);
    fastify.put('/employee/documents/:documentId/status', controller.updateDocumentStatus);

    fastify.get("/employee/schedule/:id", controller.getEmployeeSchedule);
    fastify.post("/employee/availability", controller.saveAvailability);

    fastify.get("/employee/timelogs/:id", controller.getEmployeeTimeLogs);
    fastify.get("/employee/attendance-data/:id", controller.getEmployeeAttendanceData);

    fastify.put("/employee/:id/availability", controller.updateEmployeeAvailability);

    fastify.post("/employee/request/:id", controller.sendRequest);
    fastify.delete("/employee/request/:type/:requestId", controller.deleteRequest);
    fastify.put("/employee/requests/:requestId/action", controller.handleRequestAction);
    fastify.get("/employee/requests/:id", controller.getRequests);

    fastify.get("/employee/notification/:id", controller.getNotificationCount);
    fastify.put("/employee/notification/reset/:id", controller.resetNotificationCount);
    fastify.get("/employee/notifications/:id", controller.getEmployeeNotifications);
    fastify.delete("/employee/notifications/:id/clear-read", controller.clearEmployeeNotifications);
    fastify.put("/employee/notifications/:id/read", controller.marKNotificationRead);

    fastify.get("/employee/leave/:id", controller.getLeaveDays);
}