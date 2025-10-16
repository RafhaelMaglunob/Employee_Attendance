import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
const SECRET_KEY = "your_secret_here";  
export function employeeAccountController(pool) {
    
    const getLoginEmployeeAccount = async (req, reply) => {
        const { email, password } = req.body;
        try {
            const result = await pool.query(
                `SELECT employee_id, email, password FROM employee_account WHERE email = $1`,
                [email]
            );

            if (result.rows.length === 0) {
                return reply.status(404).send({ error: 'Email does not exist.' });
            }

            const user = result.rows[0];
            const isMatch = await bcrypt.compare(password, user.password);

            if (!isMatch) {
                return reply.status(401).send({ error: 'Incorrect email or password.' });
            }

            // Remove password from user object
            delete user.password;

            // Generate JWT token
            const token = jwt.sign(
                { id: user.id, email: user.email, role: user.role },
                SECRET_KEY,
                { expiresIn: '1d' }
            );

            reply.send({ success: true, token, data: user });
        } catch (err) {
            console.error("Database error:", err.message);
            reply.status(500).send({ error: 'Internal server error.' });
        }
    };

    return {
        getLoginEmployeeAccount
    }
}