import { certificateController } from '../controllers/certificateController.js';

export async function certificateRoutes(fastify, options) {
  const controller = certificateController(fastify.pg);

  // ========================================
  // EMPLOYEE ROUTES
  // ========================================

  fastify.post('/employee/:id/certificate', {
    preHandler: [fastify.authenticate]
  }, controller.requestCertificate);

  fastify.get('/employee/:id/certificates', {
    preHandler: [fastify.authenticate]
  }, controller.getMyCertificates);

  fastify.get('/employee/certificate/:certificateId/download', {
    preHandler: [fastify.authenticate]
  }, controller.downloadCertificate);

  // ========================================
  // ADMIN/HR ROUTES
  // ========================================

  fastify.get('/admin/certificates', {
    preHandler: [fastify.authenticate]
  }, controller.getAllCertificateRequests);

  fastify.put('/admin/certificate/:certificateId/approve', {
    preHandler: [fastify.authenticate]
  }, controller.approveCertificate);

  fastify.put('/admin/certificate/:certificateId/reject', {
    preHandler: [fastify.authenticate]
  }, controller.rejectCertificate);

  fastify.get('/admin/certificate/:certificateId/download', {
    preHandler: [fastify.authenticate]
  }, controller.downloadCertificate);
}
