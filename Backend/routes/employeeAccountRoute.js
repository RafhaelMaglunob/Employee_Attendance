import { employeeAccountController } from "../controllers/employeeAccountController.js";

export function employeeAccountRoutes(fastify, options){
    const controller = employeeAccountController(fastify.pg);

    fastify.post("/employee-login", controller.getLoginEmployeeAccount);
}