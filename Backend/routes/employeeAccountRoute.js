import { employeeAccountController } from "../controllers/employeeAccountController.js";
import { authMiddleware } from "../middleware/authMiddleware.js";

export function employeeAccountRoutes(fastify, options){
    const io = options.io;
    const controller = employeeAccountController(fastify.pg, io);

    fastify.post("/employee-login", controller.getLoginEmployeeAccount);
    fastify.put("/employee/change-password", { preHandler: authMiddleware}, controller.changeEmployeePassword);
    fastify.get("/employee/schedule/:id", controller.getEmployeeSchedule);
    fastify.post("/employee/availability", controller.saveAvailability);
    fastify.post("/employee/request/:id", controller.sendRequest);
    fastify.delete("/employee/request/:requestId", controller.deleteRequest);
    fastify.put("/employee/requests/:requestId/action", controller.handleRequestAction);
    fastify.get("/employee/requests/:id", controller.getRequests);
    fastify.get("/employee/leave/:id", controller.getLeaveDays);
}