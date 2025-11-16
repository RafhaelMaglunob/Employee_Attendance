import argon2 from "argon2";

export function adminAccountController(pool) {

    const createAdminAccount = async (req, reply) => {
        const { email, password, fullname } = req.body;

        try {
            // Check if email already exists
            const { rows: existing } = await pool.query(
                `SELECT 1 FROM users WHERE email = $1`,
                [email]
            );

            if (existing.length > 0) {
                return reply.status(400).send({ error: "Email already exists." });
            }

            // Hash the password (argon2id is the recommended variant)
            const hashedPassword = await argon2.hash(password, { type: argon2.argon2id });

            // Insert user
            await pool.query(
                `INSERT INTO users(email, fullname, password, role)
                 VALUES ($1, $2, $3, $4)`,
                [email, fullname || null, hashedPassword, 'Admin']
            );

            reply.send({ message: "Admin account created successfully!" });

        } catch (err) {
            console.error("Database error:", err.message);
            reply.status(500).send({ error: "Failed to create admin account." });
        }
    };

    const getLoginAdminAccount = async (req, reply) => {
        const { email, password } = req.body;

        console.log('🔍 Login attempt for:', email);
        console.log('🔍 Password length:', password?.length);

        try {
            const { rows } = await pool.query(
                `SELECT email, fullname, password, role FROM users WHERE email = $1`,
                [email]
            );

            console.log('📊 Query result:', rows.length, 'users found');

            if (rows.length === 0) {
                console.log('❌ User not found');
                return reply.status(404).send({ error: "Email does not exist." });
            }

            const user = rows[0];
            console.log('👤 User found:', { email: user.email, role: user.role, fullname: user.fullname });
            console.log('🔑 Hash starts with:', user.password.substring(0, 20));

            // Check role
            const normalizedRole = user.role.toLowerCase();
            console.log('🔑 Role check:', normalizedRole, '| Valid:', ['admin', 'hr', 'head staff'].includes(normalizedRole));
            
            if (!['admin', 'hr', 'head staff'].includes(normalizedRole)) {
                console.log('❌ Invalid role');
                return reply.status(403).send({ error: "Credentials invalid." });
            }

            // Verify password
            console.log('🔐 Verifying password...');
            try {
                const isMatch = await argon2.verify(user.password, password);
                console.log('🔐 Password match:', isMatch);
                
                if (!isMatch) {
                    console.log('❌ Password mismatch');
                    return reply.status(401).send({ error: "Incorrect email or password." });
                }
            } catch (verifyError) {
                console.error('❌ Argon2 verify error:', verifyError);
                return reply.status(401).send({ error: "Password verification failed." });
            }

            console.log('✅ Login successful');
            delete user.password;
            reply.send({ success: true, data: user });

        } catch (err) {
            console.error("❌ Database error:", err.message);
            console.error("❌ Stack:", err.stack);
            reply.status(500).send({ error: "Internal server error." });
        }
    };

    const resetAdminPassword = async (req, reply) => {
        const { email, newPassword } = req.body;
        
        console.log('🔄 Password reset attempt for:', email);
        
        try {
            const hashedPassword = await argon2.hash(newPassword, { type: argon2.argon2id });
            
            const result = await pool.query(
                `UPDATE users SET password = $1 WHERE email = $2 RETURNING email`,
                [hashedPassword, email]
            );
            
            if (result.rows.length === 0) {
                return reply.status(404).send({ error: "User not found" });
            }
            
            console.log('✅ Password reset successful for:', email);
            reply.send({ message: "Password reset successfully!" });
        } catch (err) {
            console.error("❌ Reset error:", err);
            reply.status(500).send({ error: "Failed to reset password" });
        }
    };

    return {
        createAdminAccount,
        getLoginAdminAccount,
        resetAdminPassword,
    };
}