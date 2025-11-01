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

        try {
            const { rows } = await pool.query(
                `SELECT email, fullname, password, role FROM users WHERE email = $1`,
                [email]
            );

            if (rows.length === 0) {
                return reply.status(404).send({ error: "Email does not exist." });
            }

            const user = rows[0];

            if (!['admin', 'hr', 'head staff'].includes(user.role.toLowerCase())) {
                return reply.status(403).send({ error: "Credentials invalid." });
            }

            // ✅ Correct verify order
            const isMatch = await argon2.verify(user.password, password);
            if (!isMatch) {
                return reply.status(401).send({ error: "Incorrect email or password." });
            }

            delete user.password;
            reply.send({ success: true, data: user });

        } catch (err) {
            console.error("Database error:", err.message);
            reply.status(500).send({ error: "Internal server error." });
        }
    };

    return {
        createAdminAccount,
        getLoginAdminAccount,
    };
}
