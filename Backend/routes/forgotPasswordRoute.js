// routes/forgotPasswordRoute.js
import { forgotPasswordController } from "../controllers/forgotPasswordController.js";

export function forgotPasswordRoutes(fastify, options) {
    const controller = forgotPasswordController(fastify.pg);

    // ==================== ADMIN ROUTES ====================
    
    // Request admin password reset - sends email with token
    fastify.post("/admin/forgot-password", controller.requestAdminPasswordReset);
    
    // Verify if admin reset token is valid
    fastify.get("/admin/verify-reset-token/:token", controller.verifyAdminResetToken);
    
    // Reset admin password with token
    fastify.post("/admin/reset-password", controller.resetAdminPassword);

    // ==================== EMPLOYEE ROUTES ====================
    
    // Request employee password reset - sends email with token
    fastify.post("/employee/forgot-password", controller.requestEmployeePasswordReset);
    
    // Verify if employee reset token is valid
    fastify.get("/employee/verify-reset-token/:token", controller.verifyEmployeeResetToken);
    
    // Reset employee password with token
    fastify.post("/employee/reset-password", controller.resetEmployeePassword);
}