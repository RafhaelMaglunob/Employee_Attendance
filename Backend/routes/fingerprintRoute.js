import { fingerprintController } from '../controllers/fingerprintController.js';

export async function fingerprintRoutes(fastify, options) {
    const fingerprint = fingerprintController(fastify.pg);

    // Get occupied fingerprint slots
    fastify.get('/fingerprint/occupied-slots', async (req, reply) => {
        return fingerprint.getOccupiedSlots(req, reply);
    });

    // Start fingerprint enrollment
    fastify.post('/fingerprint/enroll', {
        preHandler: [fastify.authenticate]
    }, async (req, reply) => {
        return fingerprint.startEnrollment(req, reply);
    });

    // Get enrollment status (polling endpoint)
    fastify.get('/fingerprint/enroll-status', async (req, reply) => {
        return fingerprint.getEnrollmentStatus(req, reply);
    });

    // Handle attendance clock from Arduino
    fastify.post('/fingerprint/attendance/clock', async (req, reply) => {
        return fingerprint.handleAttendanceClock(req, reply);
    });

    // Delete fingerprint registration
    fastify.delete('/fingerprint/:slot', {
        preHandler: [fastify.authenticate]
    }, async (req, reply) => {
        return fingerprint.deleteFingerprint(req, reply);
    });

    // Get employee fingerprints
    fastify.get('/fingerprint/employee/:employee_id', {
        preHandler: [fastify.authenticate]
    }, async (req, reply) => {
        return fingerprint.getEmployeeFingerprints(req, reply);
    });

    // Get all fingerprints (admin)
    fastify.get('/fingerprint/all', {
        preHandler: [fastify.authenticate]
    }, async (req, reply) => {
        return fingerprint.getAllFingerprints(req, reply);
    });

    // Get fingerprint attendance logs
    fastify.get('/fingerprint/logs', {
        preHandler: [fastify.authenticate]
    }, async (req, reply) => {
        return fingerprint.getFingerprintLogs(req, reply);
    });
}