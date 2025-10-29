import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { syncRow, deleteRow } from '../utils/syncToSupabase.js';

const SECRET_KEY = "your_secret_here";

const TIME_RANGES = {
    Opening: { start_time: '07:00:00', end_time: '13:00:00' },
    Closing: { start_time: '15:00:00', end_time: '20:00:00' },
};

export function employeeAccountController(pool) {

    const getLoginEmployeeAccount = async (req, reply) => {
        const { email, password } = req.body;
        try {
            const result = await pool.query(
                `SELECT account_id, employee_id, email, password, role, must_change_password 
                 FROM users 
                 WHERE email = $1 AND (role = 'Head Staff' OR role = 'Crew')`,
                [email]
            );

            if (!result.rows.length) return reply.status(404).send({ error: 'Email does not exist or role not allowed.' });

            const user = result.rows[0];
            const isMatch = await bcrypt.compare(password, user.password);
            if (!isMatch) return reply.status(401).send({ error: 'Incorrect email or password.' });

            delete user.password;

            const token = jwt.sign(
                { id: user.account_id, email: user.email, role: user.role, must_change_password: user.must_change_password },
                "yourSuperSecretKeyHere",
                { expiresIn: '1d' }
            );

            reply.send({ success: true, token, data: user });
        } catch (err) {
            console.error("Database error:", err.message);
            reply.status(500).send({ error: 'Internal server error.' });
        }
    };

    const changeEmployeePassword = async (req, reply) => {
        const { oldPassword, newPassword } = req.body;
        const accountId = req.user.id; // comes from JWT payload

        if (!oldPassword || !newPassword) {
            return reply.status(400).send({ error: "Both old and new passwords are required." });
        }

        try {
            // Use the pool passed to the controller
            const result = await pool.query(
                `SELECT password FROM users WHERE account_id = $1`,
                [accountId]
            );

            if (!result.rows.length) {
                return reply.status(404).send({ error: "User not found." });
            }

            const user = result.rows[0];

            // Check old password
            const isMatch = await bcrypt.compare(oldPassword, user.password);
            if (!isMatch) {
                return reply.status(401).send({ error: "Old password is incorrect." });
            }

            // Hash new password
            const hashedNewPassword = await bcrypt.hash(newPassword, 10);

            // Update password in DB
            await pool.query(
                `UPDATE users SET password = $1, must_change_password = false WHERE account_id = $2`,
                [hashedNewPassword, accountId]
            );

            // Optional: sync to Supabase
            const updatedUser = await pool.query(
                `SELECT * FROM users WHERE account_id = $1`,
                [accountId]
            );
            await syncRow('users', updatedUser.rows[0], 'account_id');

            reply.send({ success: true, message: "Password updated successfully." });
        } catch (err) {
            console.error("Change password error:", err);
            reply.status(500).send({ error: "Internal server error." });
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
            if (!employee_id || !date || !Array.isArray(times)) {
                return reply.status(400).send({ message: "Invalid request data" });
            }

            const { rows: currentSchedule } = await pool.query(
                `SELECT start_time, end_time FROM employee_schedule WHERE employee_id = $1 AND work_date = $2`,
                [employee_id, date]
            );

            const currentTimes = currentSchedule
                .map(row => {
                    if (row.start_time === "07:00:00" && row.end_time === "13:00:00") return "Opening";
                    if (row.start_time === "15:00:00" && row.end_time === "20:00:00") return "Closing";
                    return null;
                })
                .filter(Boolean);

            const timesToAdd = times.filter(t => !currentTimes.includes(t));
            const timesToRemove = currentTimes.filter(t => !times.includes(t));

            for (const t of timesToRemove) {
                const { start_time, end_time } = TIME_RANGES[t];
                await pool.query(
                    `DELETE FROM employee_schedule WHERE employee_id = $1 AND work_date = $2 AND start_time = $3 AND end_time = $4`,
                    [employee_id, date, start_time, end_time]
                );
            }

            for (const t of timesToAdd) {
                const { start_time, end_time } = TIME_RANGES[t];
                const { rows } = await pool.query(
                    `INSERT INTO employee_schedule (employee_id, work_date, start_time, end_time) VALUES ($1, $2, $3, $4) RETURNING *`,
                    [employee_id, date, start_time, end_time]
                );

                // Sync to Supabase using your utility
                await syncRow('employee_schedule', rows[0], 'schedule_id');
            }

            reply.status(200).send({ message: "Schedule updated successfully" });
        } catch (err) {
            console.error("Error saving availability:", err);
            reply.status(500).send({ message: "Server error" });
        }
    };

    // GET /employee/leave/:id?start=YYYY-MM-DD&end=YYYY-MM-DD
    const getLeaveDays = async (req, reply) => {
        const { id } = req.params;
        let { start, end } = req.query;

        if (!start || !end) {
            return reply.status(400).send({ success: false, message: "Start and end dates are required", days: 0 });
        }

        try {
            const res = await pool.query(
                `SELECT COUNT(DISTINCT work_date) AS days
                FROM employee_schedule
                WHERE employee_id = $1 
                AND work_date BETWEEN $2 AND $3`,
                [id, start, end]
            );

            reply.send({ success: true, days: parseInt(res.rows[0].days, 10) });
        } catch (err) {
            console.error(err);
            reply.status(500).send({ success: false, days: 0 });
        }
    };


    const sendRequest = async (req, reply, io) => {
        try {
            const { id } = req.params;
            const { request_type, type, date, startDate, endDate, reason, link, hours } = req.body;
            console.log(hours);
            let days = null;
            let finalStartDate = null;
            let finalEndDate = null;
            let finalDate = null;

            // Leave → use startDate/endDate and calculate work days
            if (request_type === "leave") {
                finalStartDate = startDate;
                finalEndDate = endDate;
                const scheduleRes = await pool.query(
                    `SELECT COUNT(DISTINCT work_date) AS work_days
                    FROM employee_schedule 
                    WHERE employee_id = $1 
                    AND work_date BETWEEN $2 AND $3`,
                    [id, startDate, endDate]
                );
                days = scheduleRes.rows[0].work_days;
            } else  {
                finalDate = date;
                days = 0;         // explicitly 0
                finalStartDate = null;
                finalEndDate = null;
            }

            const { rows } = await pool.query(
            `INSERT INTO employee_requests (
                employee_id,
                request_type,
                type,
                days,
                date,
                start_date,
                end_date,
                reason,
                link,
                hours,
                status
            ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'pending')
            RETURNING *`,
            [
                id,
                request_type,
                type,
                days,
                finalDate,
                finalStartDate,
                finalEndDate,
                reason,
                link,
                hours
            ]
            );

            await syncRow('employee_requests', rows[0], 'request_id');
            io?.emit("employeeRequestCreated", rows[0]);

            reply.code(201).send({ success: true, message: "Request submitted", data: rows[0] });
        } catch (err) {
            console.error("Error submitting request:", err);
            reply.code(500).send({ success: false, message: "Error submitting request" });
        }
    };


    const deleteRequest = async (req, reply) => {
        const { requestId } = req.params;
        try {
            if (isNaN(requestId)) return reply.code(400).send({ success: false, message: "Invalid request ID" });

            // Delete from local DB
            const result = await pool.query(
                "DELETE FROM employee_requests WHERE request_id = $1 RETURNING *",
                [requestId]
            );

            if (result.rowCount === 0) {
                return reply.code(404).send({ success: false, message: "Request not found" });
            }

            // Delete from Supabase
            await deleteRow('employee_requests', 'request_id', result.rows[0].request_id);

            reply.send({ success: true, message: "Request cancelled" });
        } catch (err) {
            console.error("Delete request error:", err);
            reply.code(500).send({ success: false, message: "Failed to cancel request" });
        }
    };



    const getRequests = async (req, reply) => {
        const { id } = req.params;
        const { type } = req.query;
        const reqType = type?.toLowerCase();
        try {
            const { rows } = await pool.query(
                "SELECT * FROM employee_requests WHERE employee_id = $1 AND request_type = $2  ORDER BY created_at DESC LIMIT 10",
                [id, reqType]
            );
            reply.send({ success: true, data: rows });
        } catch (err) {
            console.error(err);
            reply.code(500).send({ success: false, message: "Error fetching requests" });
        }
    };

    const handleRequestAction = async (req, reply) => {
        const io = req.server.io; // socket.io instance
        const { requestId } = req.params;
        const { action } = req.body; // "accept" or "decline"
        const client = await pool.connect();

        try {
            await client.query("BEGIN");

            // Determine status
            const status = action === "approved" ? "approved" : "rejected";

            // Update request
            const updateRes = await client.query(
                `UPDATE employee_requests
                SET status = $1
                WHERE request_id = $2
                RETURNING *`,
                [status, parseInt(requestId)]
            );

            if (!updateRes.rows.length) {
                await client.query("ROLLBACK");
                return reply.status(404).send({ success: false, message: "Request not found" });
            }

            const updatedRequest = updateRes.rows[0];
            await client.query("COMMIT");

            // Emit WebSocket update
            io?.emit("employeeRequestUpdated", {
                ...updatedRequest,
                request_type: updatedRequest.request_type.toLowerCase(),
                status: updatedRequest.status.toLowerCase(),
            });

            return reply.send({ success: true, data: updatedRequest });

        } catch (err) {
            await client.query("ROLLBACK");
            console.error("Error updating request:", err);
            return reply.status(500).send({ success: false, message: "Failed to update request" });
        } finally {
            client.release();
        }
    };
    
    return {
        getLoginEmployeeAccount,
        changeEmployeePassword,
        getEmployeeSchedule,
        saveAvailability,
        sendRequest,
        getRequests,
        getLeaveDays,
        deleteRequest,
        handleRequestAction
    };
}
