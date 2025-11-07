import { fingerprintController } from '../controllers/fingerprintController.js';

export async function fingerprintRoutes(fastify, options) {
    const fingerprint = fingerprintController(fastify.pg);
    const { io } = options; // Get io from options

    // Start fingerprint enrollment (hardware only)
    fastify.post('/fingerprint/enroll', {
        preHandler: [fastify.authenticate]
    }, async (req, reply) => {
        return fingerprint.startEnrollment(req, reply);
    });

    // Get enrollment status (polling endpoint - no auth to avoid token issues during polling)
    fastify.get('/fingerprint/enroll-status', async (req, reply) => {
        return fingerprint.getEnrollmentStatus(req, reply);
    });

    // Handle attendance clock from Arduino (no auth - direct from device)
    fastify.post('/fingerprint/attendance/clock', async (req, reply) => {
        return fingerprint.handleAttendanceClock(req, reply);
    });

    // Delete fingerprint registration
    fastify.delete('/fingerprint/:slot', async (req, reply) => {
        try {
            // Call the delete function
            await fingerprint.deleteFingerprint(req, reply);
            
            // Get slot from params
            const { slot } = req.params;
            const slotNum = parseInt(slot, 10);
            
            // Emit socket event to all connected admins
            if (io) {
                io.emit('fingerprint:deleted', {
                    slot: slotNum,
                    timestamp: new Date().toISOString(),
                    message: `Fingerprint deleted from slot ${slotNum}`
                });
                
                console.log(`📡 Socket: Emitted fingerprint:deleted for slot ${slotNum}`);
            }
        } catch (error) {
            console.error('Error in delete route:', error);
            throw error;
        }
    });

    // Start re-enrollment
    fastify.post('/fingerprint/reenroll', {
        preHandler: [fastify.authenticate]
    }, async (req, reply) => {
        try {
            await fingerprint.startReenroll(req, reply);
            
            const { slot, employee_id } = req.body;
            
            // Emit to admin dashboard
            if (io) {
                io.emit('fingerprint:reenroll-started', {
                    slot: parseInt(slot, 10),
                    employee_id,
                    timestamp: new Date().toISOString(),
                    message: `Re-enrollment started for slot ${slot}`
                });
                
                // Emit to specific employee
                io.to(`employee_${employee_id}`).emit('fingerprint:ready-to-enroll', {
                    slot: parseInt(slot, 10),
                    message: 'You can now enroll your new fingerprint'
                });
                
                console.log(`📡 Socket: Emitted fingerprint:reenroll-started for slot ${slot}`);
            }
        } catch (error) {
            console.error('Error in reenroll route:', error);
            throw error;
        }
    });

    // Cancel re-enrollment
    fastify.post('/fingerprint/reenroll/cancel', {
        preHandler: [fastify.authenticate]
    }, async (req, reply) => {
        try {
            await fingerprint.cancelReenroll(req, reply);
            
            const { slot } = req.body;
            
            if (io) {
                io.emit('fingerprint:reenroll-cancelled', {
                    slot: parseInt(slot, 10),
                    timestamp: new Date().toISOString(),
                    message: `Re-enrollment cancelled for slot ${slot}`
                });
                
                console.log(`📡 Socket: Emitted fingerprint:reenroll-cancelled for slot ${slot}`);
            }
        } catch (error) {
            console.error('Error in cancel reenroll route:', error);
            throw error;
        }
    });

    // Confirm re-enrollment
    fastify.post('/fingerprint/reenroll/confirm', {
        preHandler: [fastify.authenticate]
    }, async (req, reply) => {
        try {
            await fingerprint.confirmReenroll(req, reply);
            
            const { slot } = req.body;
            
            if (io) {
                io.emit('fingerprint:reenroll-confirmed', {
                    slot: parseInt(slot, 10),
                    timestamp: new Date().toISOString(),
                    message: `New fingerprint confirmed for slot ${slot}`
                });
                
                console.log(`📡 Socket: Emitted fingerprint:reenroll-confirmed for slot ${slot}`);
            }
        } catch (error) {
            console.error('Error in confirm reenroll route:', error);
            throw error;
        }
    });

    // Get employees with fingerprint status (admin view)
    fastify.get('/fingerprint/admin/employees', async (req, reply) => {
        console.log('📍 GET /fingerprint/admin/employees called');
        console.log('🔑 Authorization header:', req.headers.authorization);
        
        // Try to verify token if present, but don't fail if missing
        if (req.headers.authorization) {
            try {
                await req.jwtVerify();
                console.log('✅ Token verified successfully');
            } catch (err) {
                console.log('⚠️  Token verification failed:', err.message);
                // Continue anyway for now
            }
        }
        
        return fingerprint.getEmployeesWithFingerprintStatus(req, reply);
    });

    // Get fingerprint attendance logs
    fastify.get('/fingerprint/logs', {
        preHandler: [fastify.authenticate]
    }, async (req, reply) => {
        return fingerprint.getFingerprintLogs(req, reply);
    });

    // DEBUG: Token verification test endpoint
    fastify.get('/fingerprint/test-token', async (req, reply) => {
        console.log('🧪 Testing token verification...');
        console.log('Authorization header:', req.headers.authorization);
        
        try {
            await req.jwtVerify();
            return reply.send({ 
                success: true, 
                message: '✅ Token is valid',
                user: req.user
            });
        } catch (err) {
            return reply.status(401).send({
                success: false,
                message: '❌ Token verification failed',
                error: err.message,
                authHeader: req.headers.authorization || 'NOT PROVIDED'
            });
        }
    });
}