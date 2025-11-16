// controllers/forgotPasswordController.js
import crypto from 'crypto';
import argon2 from 'argon2';
import { sendPasswordResetEmail, sendPasswordChangedEmail } from '../utils/sendEmail.js';

export function forgotPasswordController(pool) {

    // ==================== ADMIN PASSWORD RESET ====================
    
    // POST /api/admin/forgot-password
    const requestAdminPasswordReset = async (req, reply) => {
        try {
            const { email } = req.body;

            console.log('🔐 Admin password reset requested for:', email);

            if (!email) {
                return reply.status(400).send({ 
                    success: false, 
                    error: 'Email is required' 
                });
            }

            // Email format validation
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailRegex.test(email)) {
                return reply.status(400).send({ 
                    success: false, 
                    error: 'Invalid email format' 
                });
            }

            // Check if admin user exists
            const userResult = await pool.query(
                'SELECT account_id, email, fullname, role FROM users WHERE email = $1 AND role = $2',
                [email, 'Admin']
            );

            if (userResult.rows.length === 0) {
                console.log('⚠️ No admin user found with email:', email);
                // Still return success for security (don't reveal if email exists)
                return reply.send({ 
                    success: true,
                    message: 'If an account exists, a reset link has been sent to your email' 
                });
            }

            const user = userResult.rows[0];
            console.log('✅ Admin user found:', user.fullname);

            // Generate and store reset token
            const resetToken = crypto.randomBytes(32).toString('hex');
            const resetTokenExpiry = new Date(Date.now() + 3600000); // 1 hour

            await pool.query(
                `INSERT INTO password_reset_tokens (email, token, expiry, user_role)
                 VALUES ($1, $2, $3, $4)
                 ON CONFLICT (email) 
                 DO UPDATE SET token = $2, expiry = $3, created_at = CURRENT_TIMESTAMP`,
                [email, resetToken, resetTokenExpiry, 'Admin']
            );

            console.log('💾 Token stored in database');

            // 🔧 FIX: Send response to UI first, then send email in background
            reply.send({ 
                success: true,
                message: 'Password reset link sent to your email' 
            });

            // Send email in background (non-blocking)
            setImmediate(async () => {
                try {
                    await sendPasswordResetEmail(email, user.fullname, resetToken, 'admin');
                    console.log(`✅ Password reset email sent to ${email}`);
                } catch (emailError) {
                    console.error('❌ Email sending failed:', emailError);
                    // Email failure is logged but doesn't affect the response
                }
            });

        } catch (error) {
            console.error('❌ Admin forgot password error:', error);
            reply.status(500).send({ 
                success: false,
                error: 'Failed to process reset request. Please try again later.' 
            });
        }
    };

    // GET /api/admin/verify-reset-token/:token
    const verifyAdminResetToken = async (req, reply) => {
        try {
            const { token } = req.params;
            console.log('🔍 Verifying admin reset token');

            const result = await pool.query(
                `SELECT email, expiry FROM password_reset_tokens 
                 WHERE token = $1 AND expiry > NOW() AND user_role = $2`,
                [token, 'Admin']
            );

            if (result.rows.length === 0) {
                console.log('❌ Invalid or expired admin token');
                return reply.status(400).send({ 
                    success: false,
                    error: 'Invalid or expired reset token' 
                });
            }

            console.log('✅ Admin token verified');
            reply.send({ 
                success: true,
                valid: true, 
                email: result.rows[0].email 
            });

        } catch (error) {
            console.error('❌ Verify admin token error:', error);
            reply.status(500).send({ 
                success: false,
                error: 'Failed to verify token' 
            });
        }
    };

    // POST /api/admin/reset-password
    const resetAdminPassword = async (req, reply) => {
        try {
            const { token, newPassword } = req.body;
            console.log('🔐 Admin password reset attempt');

            if (!token || !newPassword) {
                return reply.status(400).send({ 
                    success: false,
                    error: 'Token and new password are required' 
                });
            }

            if (newPassword.length < 6) {
                return reply.status(400).send({ 
                    success: false,
                    error: 'Password must be at least 6 characters long' 
                });
            }

            // Verify token
            const tokenResult = await pool.query(
                `SELECT email FROM password_reset_tokens 
                 WHERE token = $1 AND expiry > NOW() AND user_role = $2`,
                [token, 'Admin']
            );

            if (tokenResult.rows.length === 0) {
                return reply.status(400).send({ 
                    success: false,
                    error: 'Invalid or expired reset token' 
                });
            }

            const email = tokenResult.rows[0].email;

            // Get user details
            const userResult = await pool.query(
                'SELECT account_id, fullname FROM users WHERE email = $1',
                [email]
            );

            if (userResult.rows.length === 0) {
                return reply.status(404).send({ 
                    success: false,
                    error: 'User not found' 
                });
            }

            const user = userResult.rows[0];

            // Hash password with argon2id
            const hashedPassword = await argon2.hash(newPassword, { type: argon2.argon2id });
            
            await pool.query(
                'UPDATE users SET password = $1, updated_at = CURRENT_TIMESTAMP WHERE email = $2',
                [hashedPassword, email]
            );

            // Delete used token
            await pool.query('DELETE FROM password_reset_tokens WHERE token = $1', [token]);

            console.log(`✅ Admin password successfully reset for ${email}`);
            
            // 🔧 FIX: Send response first, then email in background
            reply.send({ 
                success: true,
                message: 'Password successfully reset' 
            });

            // Send confirmation email in background
            setImmediate(async () => {
                try {
                    await sendPasswordChangedEmail(email, user.fullname);
                    console.log(`✅ Password changed confirmation sent to ${email}`);
                } catch (emailError) {
                    console.error('⚠️ Failed to send confirmation email:', emailError);
                }
            });

        } catch (error) {
            console.error('❌ Reset admin password error:', error);
            reply.status(500).send({ 
                success: false,
                error: 'Failed to reset password. Please try again.' 
            });
        }
    };

    // ==================== EMPLOYEE PASSWORD RESET ====================
    
    // POST /api/employee/forgot-password
    const requestEmployeePasswordReset = async (req, reply) => {
        try {
            const { email } = req.body;

            console.log('🔐 Employee password reset requested for:', email);

            if (!email) {
                return reply.status(400).send({ 
                    success: false, 
                    error: 'Email is required' 
                });
            }

            // Email format validation
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailRegex.test(email)) {
                return reply.status(400).send({ 
                    success: false, 
                    error: 'Invalid email format' 
                });
            }

            // Check if employee/crew/HR user exists
            const userResult = await pool.query(
                `SELECT account_id, email, fullname, role FROM users 
                 WHERE email = $1 AND role IN ('Crew', 'Head Staff')`,
                [email]
            );

            if (userResult.rows.length === 0) {
                console.log('⚠️ No employee user found with email:', email);
                // Still return success for security
                return reply.send({ 
                    success: true,
                    message: 'If an account exists, a reset link has been sent to your email' 
                });
            }

            const user = userResult.rows[0];
            console.log('✅ Employee user found:', user.fullname, '- Role:', user.role);

            // Generate and store reset token
            const resetToken = crypto.randomBytes(32).toString('hex');
            const resetTokenExpiry = new Date(Date.now() + 3600000); // 1 hour

            await pool.query(
                `INSERT INTO password_reset_tokens (email, token, expiry, user_role)
                 VALUES ($1, $2, $3, $4)
                 ON CONFLICT (email) 
                 DO UPDATE SET token = $2, expiry = $3, created_at = CURRENT_TIMESTAMP`,
                [email, resetToken, resetTokenExpiry, user.role]
            );

            console.log('💾 Token stored in database');

            // 🔧 FIX: Send response to UI first, then send email in background
            reply.send({ 
                success: true,
                message: 'Password reset link sent to your email' 
            });

            // Send email in background (non-blocking)
            setImmediate(async () => {
                try {
                    await sendPasswordResetEmail(email, user.fullname, resetToken, 'employee');
                    console.log(`✅ Password reset email sent to ${email}`);
                } catch (emailError) {
                    console.error('❌ Email sending failed:', emailError);
                    // Email failure is logged but doesn't affect the response
                }
            });

        } catch (error) {
            console.error('❌ Employee forgot password error:', error);
            reply.status(500).send({ 
                success: false,
                error: 'Failed to process reset request. Please try again later.' 
            });
        }
    };

    // GET /api/employee/verify-reset-token/:token
    const verifyEmployeeResetToken = async (req, reply) => {
        try {
            const { token } = req.params;
            console.log('🔍 Verifying employee reset token');

            const result = await pool.query(
                `SELECT email, expiry FROM password_reset_tokens 
                 WHERE token = $1 AND expiry > NOW() AND user_role IN ('Crew', 'Head Staff')`,
                [token]
            );

            if (result.rows.length === 0) {
                console.log('❌ Invalid or expired employee token');
                return reply.status(400).send({ 
                    success: false,
                    error: 'Invalid or expired reset token' 
                });
            }

            console.log('✅ Employee token verified');
            reply.send({ 
                success: true,
                valid: true, 
                email: result.rows[0].email 
            });

        } catch (error) {
            console.error('❌ Verify employee token error:', error);
            reply.status(500).send({ 
                success: false,
                error: 'Failed to verify token' 
            });
        }
    };

    // POST /api/employee/reset-password
    const resetEmployeePassword = async (req, reply) => {
        try {
            const { token, newPassword } = req.body;
            console.log('🔐 Employee password reset attempt');

            if (!token || !newPassword) {
                return reply.status(400).send({ 
                    success: false,
                    error: 'Token and new password are required' 
                });
            }

            if (newPassword.length < 6) {
                return reply.status(400).send({ 
                    success: false,
                    error: 'Password must be at least 6 characters long' 
                });
            }

            // Verify token
            const tokenResult = await pool.query(
                `SELECT email FROM password_reset_tokens 
                 WHERE token = $1 AND expiry > NOW() AND user_role IN ('Crew', 'Head Staff')`,
                [token]
            );

            if (tokenResult.rows.length === 0) {
                return reply.status(400).send({ 
                    success: false,
                    error: 'Invalid or expired reset token' 
                });
            }

            const email = tokenResult.rows[0].email;

            // Get user details
            const userResult = await pool.query(
                'SELECT account_id, fullname FROM users WHERE email = $1',
                [email]
            );

            if (userResult.rows.length === 0) {
                return reply.status(404).send({ 
                    success: false,
                    error: 'User not found' 
                });
            }

            const user = userResult.rows[0];

            // Hash password with argon2id
            const hashedPassword = await argon2.hash(newPassword, { type: argon2.argon2id });
            
            await pool.query(
                'UPDATE users SET password = $1, must_change_password = $2, updated_at = CURRENT_TIMESTAMP WHERE email = $3',
                [hashedPassword, false, email]
            );

            // Delete used token
            await pool.query('DELETE FROM password_reset_tokens WHERE token = $1', [token]);

            console.log(`✅ Employee password successfully reset for ${email}`);
            
            // 🔧 FIX: Send response first, then email in background
            reply.send({ 
                success: true,
                message: 'Password successfully reset' 
            });

            // Send confirmation email in background
            setImmediate(async () => {
                try {
                    await sendPasswordChangedEmail(email, user.fullname);
                    console.log(`✅ Password changed confirmation sent to ${email}`);
                } catch (emailError) {
                    console.error('⚠️ Failed to send confirmation email:', emailError);
                }
            });

        } catch (error) {
            console.error('❌ Reset employee password error:', error);
            reply.status(500).send({ 
                success: false,
                error: 'Failed to reset password. Please try again.' 
            });
        }
    };

    return {
        // Admin routes
        requestAdminPasswordReset,
        verifyAdminResetToken,
        resetAdminPassword,
        // Employee routes
        requestEmployeePasswordReset,
        verifyEmployeeResetToken,
        resetEmployeePassword
    };
}