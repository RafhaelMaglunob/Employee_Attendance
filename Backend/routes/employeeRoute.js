import { employeeController } from "../controllers/employeeController.js";

export async function employeeRoutes(fastify, options) {
    const controller = employeeController(fastify.pg);

    fastify.get("/employees", controller.getAllEmployees);
    fastify.get("/employees/:id", controller.getSingleEmployee);
    fastify.get("/employees/contract/:id", controller.getSingleEmployeeContract);
    fastify.post("/employees", controller.addEmployee);
    fastify.put("/employees/:id", controller.updateEmployee);
    fastify.patch("/employees/:id", controller.deleteEmployee);
}
