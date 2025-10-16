import { adminAccountController } from "../controllers/adminAccountController.js"

export async function adminAccountRoutes(fastify, options) {
    const controller = adminAccountController(fastify.pg)

    fastify.post("/admin/login", controller.getLoginAdminAccount)
}
