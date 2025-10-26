import { employeeAccountController } from "../controllers/employeeAccountController.js";

export function employeeAccountRoutes(fastify, options){
    const controller = employeeAccountController(fastify.pg);

    fastify.post("/employee-login", controller.getLoginEmployeeAccount);
    fastify.get("/employee/schedule/:id", controller.getEmployeeSchedule);
    fastify.post("/employee/availability", controller.saveAvailability);
}