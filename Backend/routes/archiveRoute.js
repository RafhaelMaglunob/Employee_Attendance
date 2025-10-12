import { archiveController } from "../controllers/archiveController.js";

export async function archiveRoutes(fastify, options) {
    const controller = archiveController(fastify.pg);

    fastify.get("/archive", controller.getAllArchives);
}
