// scheduleRoutes.js
import { scheduleController } from '../controllers/scheduleController.js';

export function scheduleRoutes(fastify, options) {
    const schedule = scheduleController(fastify.pg);
    
    // GET - Fetch all schedules for date range
    fastify.get('/schedule', schedule.getSchedule);
}