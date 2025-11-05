import { scheduleController } from '../controllers/scheduleController.js';

export function scheduleRoutes(fastify, options ) {
    const schedule = scheduleController(fastify.pg);
    fastify.get('/schedule', schedule.getSchedule);
    fastify.post('/schedule', schedule.addSchedule);
    fastify.put('/schedule/:id', schedule.updateSchedule);
    fastify.delete('/schedule/:id', schedule.deleteSchedule);
    fastify.post('/schedule/publish', schedule.publishSchedules);
}