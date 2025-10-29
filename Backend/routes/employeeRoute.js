import { employeeController } from "../controllers/employeeController.js";
export async function employeeRoutes(fastify, options) {
    const io = options.io;
    const controller = employeeController(fastify.pg, io);

    fastify.get("/employees", controller.getAllEmployees);
    fastify.get("/employees/:id", controller.getSingleEmployee);
    fastify.get("/employees/contract/:id", controller.getSingleEmployeeContract);
    fastify.post("/employees", controller.addEmployee);
    fastify.put("/employees/:id", controller.updateEmployee);
    fastify.patch("/employees/:id", controller.deleteEmployee);
    fastify.get("/employees/requests", controller.getAllEmployeeRequest);
    fastify.put("/employee/requests/:requestId", controller.updateEmployeeRequest);
}
