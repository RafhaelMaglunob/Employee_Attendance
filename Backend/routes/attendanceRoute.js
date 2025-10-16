import { attendanceController } from "../controllers/attendanceController.js";

export async function attendanceRoutes(fastify, options) {
    const controller = attendanceController(fastify.pg);

    fastify.get("/attendance", controller.getAllAttendance)
}
