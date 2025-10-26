import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
const SECRET_KEY = "your_secret_here";

const TIME_RANGES = {
    Opening: { start_time: '07:00:00', end_time: '13:00:00' },
    Closing: { start_time: '15:00:00', end_time: '20:00:00' },
};

export function employeeAccountController(pool) {

    const getLoginEmployeeAccount = async (req, reply) => {
        const { email, password } = req.body;

        try {
            // Check email and role (Head Staff or Crew)
            const result = await pool.query(
                `SELECT account_id, employee_id, email, password, role 
                 FROM users 
                 WHERE email = $1 AND (role = 'Head Staff' OR role = 'Crew')`,
                [email]
            );

            if (result.rows.length === 0) {
                return reply.status(404).send({ error: 'Email does not exist or role not allowed.' });
            }

            const user = result.rows[0];
            const isMatch = await bcrypt.compare(password, user.password);

            if (!isMatch) {
                return reply.status(401).send({ error: 'Incorrect email or password.' });
            }

            // Remove password before sending response
            delete user.password;

            // Generate JWT token
            const token = jwt.sign(
                { id: user.account_id, email: user.email, role: user.role },
                SECRET_KEY,
                { expiresIn: '1d' }
            );

            reply.send({ success: true, token, data: user });

        } catch (err) {
            console.error("Database error:", err.message);
            reply.status(500).send({ error: 'Internal server error.' });
        }
    };

    const getEmployeeSchedule = async (req, reply) => {
        const { id } = req.params;

        try {
            const res = await pool.query(
                `SELECT schedule_id, employee_id, work_date, start_time, end_time, task
                 FROM employee_schedule
                 WHERE employee_id = $1
                 ORDER BY work_date, start_time`,
                [id]
            );
            reply.send({ success: true, data: res.rows });
        } catch (err) {
            console.error("Fetch schedule error:", err.message);
            reply.status(500).send({ error: "Failed to fetch schedule" });
        }
    };

    const saveAvailability = async (req, reply) => {
        const { employee_id, date, times } = req.body;
        try {

            console.log("ID:", employee_id);
            console.log("Request body:", req.body);

            if (!employee_id || !date || !Array.isArray(times)) {
                console.log("Invalid request data");
                return reply.status(400).send({ message: "Invalid request data" });
            }

            const { rows: currentSchedule } = await pool.query(
                `SELECT start_time, end_time FROM employee_schedule WHERE employee_id = $1 AND work_date = $2`,
                [employee_id, date]
            );
            console.log("Current schedule:", currentSchedule);

            const currentTimes = currentSchedule
                .map((row) => {
                    if (row.start_time === "07:00:00" && row.end_time === "13:00:00") return "Opening";
                    if (row.start_time === "15:00:00" && row.end_time === "20:00:00") return "Closing";
                    return null;
                })
                .filter(Boolean);
            console.log("Mapped current times:", currentTimes);

            const timesToAdd = times.filter((t) => !currentTimes.includes(t));
            const timesToRemove = currentTimes.filter((t) => !times.includes(t));
            console.log("Times to add:", timesToAdd);
            console.log("Times to remove:", timesToRemove);

            for (const t of timesToRemove) {
                const { start_time, end_time } = TIME_RANGES[t];
                console.log("Deleting time:", t, start_time, end_time);
                await pool.query(
                    `DELETE FROM employee_schedule WHERE employee_id = $1 AND work_date = $2 AND start_time = $3 AND end_time = $4`,
                    [employee_id, date, start_time, end_time]
                );
            }

            for (const t of timesToAdd) {
                const { start_time, end_time } = TIME_RANGES[t];
                console.log("Inserting time:", t, start_time, end_time);
                await pool.query(
                    `INSERT INTO employee_schedule (employee_id, work_date, start_time, end_time) VALUES ($1, $2, $3, $4)`,
                    [employee_id, date, start_time, end_time]
                );
            }

            console.log("Schedule update complete for", employee_id, date);
            reply.status(200).send({ message: "Schedule updated successfully" });
        } catch (err) {
            console.error("Error saving availability:", err);
            reply.status(500).send({ message: "Server error" });
        }
    };




    return {
        getLoginEmployeeAccount,
        getEmployeeSchedule,
        saveAvailability
    }
}
