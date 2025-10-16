import bcrypt from 'bcrypt';

export function adminAccountController(pool) {

    const createAdminAccount = async (req, reply) => {
        const { email, password } = req.body;

        try{
            const isEmail = pool.query(`
                SELECT * FROM admin_account WHERE email = $1    
            `, [email])

            if(isEmail) {
                return reply.status(404).send({ error: "Email already exist."})
            }

            await pool.query(`
                INSERT INTO admin_account(email, password)
                VALUES ($1, $2);
            `, [ email, password])

            reply.send({ message: `Admin account created successfully!` });
        }
        catch(err){
            await pool.query('ROLLBACK')
            console.error("Database error", err.message)
            return reply.status(500).send({ error: "Failed to create admin account."})
        }
    }

    const getLoginAdminAccount = async (req, reply) => {
        const { email, password } = req.body;
        try {
            const result = await pool.query(`SELECT email, password, role FROM admin_account WHERE email = $1`, [email]);

            if (result.rows.length === 0) {
                return reply.status(404).send({ error: 'Email does not exist.' });
            }

            const user = result.rows[0];

            if (user.role?.toLowerCase() !== "admin" && user.role?.toLowerCase() !== "hr") {
                return reply.status(404).send({ error: "Credentials invalid"})
            }

            const isMatch = await bcrypt.compare(password, user.password);

            if (!isMatch) {
                return reply.status(401).send({ error: 'Incorrect email or password.' });
            }

            delete user.password;
            reply.send({ success: true, data: user });
        } catch (err) {
            console.error("Database error:", err.message);
            reply.status(500).send({ error: 'Internal server error.' });
        }
    };


    return {
        getLoginAdminAccount,
    }
}