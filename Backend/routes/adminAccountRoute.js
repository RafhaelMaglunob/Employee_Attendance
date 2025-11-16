import { adminAccountController } from "../controllers/adminAccountController.js"

export async function adminAccountRoutes(fastify, options) {
    const controller = adminAccountController(fastify.pg)

    fastify.post("/admin/login", controller.getLoginAdminAccount)
    fastify.post("/admin/create", controller.createAdminAccount)
    
    // Temporary route for password reset - REMOVE IN PRODUCTION
    fastify.post("/admin/reset-password-debug", controller.resetAdminPassword)
}