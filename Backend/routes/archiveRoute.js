import { archiveController } from "../controllers/archiveController.js";

export async function archiveRoutes(fastify, options) {
    const controller = archiveController(fastify.pg);

    fastify.get("/archive", controller.getAllArchives);
    fastify.get("/archive/:id", controller.getSingleArchiveEmployee);
    fastify.patch("/archive/:id", controller.retrieveEmployee)
    fastify.get("/archive/contract/:id", controller.getSingleArchiveContract);
}
