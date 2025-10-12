import { employeeController } from "../controllers/employeeController.js";

export async function employeeRoutes(fastify, options) {
    const controller = employeeController(fastify.pg);

    fastify.get("/employees", controller.getAllEmployees);
    fastify.get("/employees/:id", controller.getSingleEmployee);
    fastify.post("/employees", controller.addEmployee);
    fastify.put("/employees/:id", controller.updateEmployee);
    fastify.delete("/employees/:id", controller.deleteEmployee);
}
