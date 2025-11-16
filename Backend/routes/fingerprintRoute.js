import { fingerprintController } from '../controllers/fingerprintController.js';

export async function fingerprintRoutes(fastify, options) {
  const controller = fingerprintController(fastify.pg);

  // ✅ ENROLL - No authentication required
  fastify.post(
    '/fingerprint/enroll',
    controller.startEnrollment
  );

  // ✅ ENROLLMENT STATUS - No auth needed (polling endpoint)
  fastify.get(
    '/fingerprint/enroll-status',
    controller.getEnrollmentStatus
  );

  // ✅ DELETE - No authentication required
  fastify.delete(
    '/fingerprint/:slot',
    controller.deleteFingerprint
  );

  // ✅ GET EMPLOYEES WITH FINGERPRINTS - No authentication required
  fastify.get(
    '/fingerprint/admin/employees',
    controller.getEmployeesWithFingerprintStatus
  );

  // ✅ RE-ENROLL - No authentication required
  fastify.post(
    '/fingerprint/reenroll',
    controller.startReenroll
  );

  // ✅ ATTENDANCE CLOCK - No auth (hardware endpoint)
  fastify.post(
    '/fingerprint/attendance',
    controller.handleAttendanceClock
  );

  // ✅ GET LOGS - No authentication required
  fastify.get(
    '/fingerprint/logs',
    controller.getFingerprintLogs
  );
}