import { incidentController } from '../controllers/incidentController.js';

export async function incidentRoutes(fastify, options) {
    const incident = incidentController(fastify.pg);

    fastify.get('/incidents', incident.getAllIncidents);
    fastify.get('/employee/:id/incidents', incident.getEmployeeIncidents);
    fastify.get('/incidents/:id', incident.getIncidentById);
    fastify.post('/incidents', incident.createIncident);
    fastify.put('/incidents/:id', incident.updateIncident);
    fastify.delete('/incidents/:id', incident.deleteIncident);
}
