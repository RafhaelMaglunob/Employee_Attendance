import argon2 from "argon2";
import jwt from 'jsonwebtoken';
import { syncRow, deleteRow } from '../utils/syncToSupabase.js';

const TIME_RANGES = {
    Opening: { start_time: '09:00:00', end_time: '14:00:00' },
    Closing: { start_time: '18:00:00', end_time: '23:00:00' },
};

export function employeeAccountController(pool, io) {

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
            const isMatch = await argon2.verify(user.password, password);
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
            const isMatch = await argon2.verify(user.password, oldPassword);
            if (!isMatch) {
                return reply.status(401).send({ error: "Old password is incorrect." });
            }

            // Hash new password
            const hashedNewPassword = await argon2.hash(newPassword, 10);

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
                    `INSERT INTO employee_schedule (employee_id, work_date, start_time, end_time, status) VALUES ($1, $2, $3, $4, 'pending') RETURNING *`,
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

    const getNotificationCount = async (req, reply) => {
        const { id } = req.params; // employeeId

        try {
            const res = await pool.query(
                "SELECT count FROM employee_notifications WHERE employee_id = $1",
                [id]
            );

            if (res.rows.length === 0) {
                // If no record exists, return 0
                return reply.send({ success: true, count: 0 });
            }

            return reply.send({ success: true, count: res.rows[0].count });
        } catch (err) {
            console.error("Error fetching notification count:", err);
            return reply.status(500).send({ success: false, message: "Failed to get notification count" });
        }
    };

    const resetNotificationCount = async (req, reply) => {
        const { id } = req.params; // employeeId

        try {
            // Update count to 0 and return the updated row
            const res = await pool.query(
                "UPDATE employee_notifications SET count = 0 WHERE employee_id = $1 RETURNING *",
                [id]
            );

            // If no record exists for this employee, respond with count 0
            if (res.rowCount === 0) {
                return reply.send({ success: true, count: 0 });
            }

            return reply.send({ success: true, count: res.rows[0].count });
        } catch (err) {
            console.error("Error resetting notification count:", err);
            return reply.status(500).send({ success: false, message: "Failed to reset notification count" });
        }
    };


    const sendRequest = async (req, reply) => {
        try {
            const { id } = req.params;
            const { request_type, type, date, startDate, endDate, reason, link, hours } = req.body;

            if (!request_type) return reply.code(400).send({ success: false, message: "Request type required" });

            // Fetch all existing requests for this employee
            const { rows: existingLeaves } = await pool.query(
                `SELECT request_id, start_date, end_date, type, status
                FROM leave_requests
                WHERE employee_id = $1`,
                [id]
            );

            const { rows: existingOvertimes } = await pool.query(
                `SELECT request_id, date, type, status
                FROM overtime_requests
                WHERE employee_id = $1`,
                [id]
            );

            const { rows: existingOffsets } = await pool.query(
                `SELECT request_id, date, type, status
                FROM offset_requests
                WHERE employee_id = $1`,
                [id]
            );

            // Combine all requests into one array
            const allRequests = [
                ...existingLeaves.map(r => ({ ...r, request_type: "leave", start: r.start_date, end: r.end_date })),
                ...existingOvertimes.map(r => ({ ...r, request_type: "overtime", start: r.date, end: r.date })),
                ...existingOffsets.map(r => ({ ...r, request_type: "off-set", start: r.date, end: r.date }))
            ];

            // Check conflicts
            const conflicts = allRequests.filter(r => {
                if (request_type === "leave") {
                    const reqStart = new Date(startDate);
                    const reqEnd = new Date(endDate);
                    const existStart = new Date(r.start);
                    const existEnd = new Date(r.end);
                    return reqStart <= existEnd && reqEnd >= existStart; // overlap check
                } else {
                    const reqDate = new Date(date);
                    const existStart = new Date(r.start);
                    const existEnd = new Date(r.end);
                    return reqDate >= existStart && reqDate <= existEnd; // single day overlap
                }
            });

            // Handle conflicts
            if (conflicts.length > 0) {
                // Emergency Leave special case
                if (request_type === "leave" && type.toLowerCase() === "emergency leave") {
                    // Only return pending requests for deletion confirmation
                    const pendingConflicts = conflicts.filter(r => r.status.toLowerCase() === "pending");
                    return reply.code(409).send({
                        success: false,
                        message: `You have overlapping requests on these dates:`,
                        conflicts: pendingConflicts
                    });
                } else {
                    const conflictDates = conflicts.map(r => {
                        if (r.request_type === "leave") {
                            return `${r.start.toISOString().split("T")[0]} - ${r.end.toISOString().split("T")[0]}`;
                        } else {
                            return r.start.toISOString().split("T")[0];
                        }
                    });
                    return reply.code(409).send({
                        success: false,
                        message: `You already have requests on these dates: ${conflictDates.join(", ")}`
                    });
                }
            }

            // Proceed with insertion if no conflicts or after deleting pending conflicts
            let insertedRow;
            let table;

            if (request_type === "leave") {
                table = "leave_requests";

                const { rows: scheduleRes } = await pool.query(
                    `SELECT COUNT(DISTINCT work_date) AS work_days
                    FROM employee_schedule 
                    WHERE employee_id = $1 AND work_date BETWEEN $2 AND $3`,
                    [id, startDate, endDate]
                );
                const days = scheduleRes[0].work_days;

                const { rows } = await pool.query(
                    `INSERT INTO leave_requests
                        (employee_id, type, days, start_date, end_date, reason, attach_link)
                    VALUES ($1,$2,$3,$4,$5,$6,$7)
                    RETURNING *`,
                    [id, type, days, startDate, endDate, reason, link]
                );
                insertedRow = rows[0];

            } else if (request_type === "overtime") {
                table = "overtime_requests";
                const { rows } = await pool.query(
                    `INSERT INTO overtime_requests
                        (employee_id, type, date, hours, reason, attach_link)
                    VALUES ($1,$2,$3,$4,$5,$6)
                    RETURNING *`,
                    [id, type, date, hours, reason, link]
                );
                insertedRow = rows[0];

            } else if (request_type === "off-set") {
                table = "offset_requests";
                const { rows } = await pool.query(
                    `INSERT INTO offset_requests
                        (employee_id, type, date, hours, reason, attach_link)
                    VALUES ($1,$2,$3,$4,$5,$6)
                    RETURNING *`,
                    [id, type, date, hours, reason, link]
                );
                insertedRow = rows[0];
            }

            // Sync to Supabase
            if (insertedRow) {
                try {
                    await syncRow(table, insertedRow, "request_id");
                } catch (err) {
                    console.warn("syncRow warning:", err?.message || err);
                }
            }

            // Update notification
            await pool.query(
                `INSERT INTO employee_notifications (employee_id, count)
                VALUES ($1, 1)
                ON CONFLICT (employee_id) DO UPDATE SET count = employee_notifications.count + 1`,
                [id]
            );

            // Emit WebSocket event
            if (io) io.to(id).emit(`${request_type}RequestCreated`, insertedRow);

            return reply.code(201).send({ success: true, message: "Request submitted", data: insertedRow });

        } catch (err) {
            console.error("Error submitting request:", err);
            return reply.code(500).send({ success: false, message: "Error submitting request" });
        }
    };


    const deleteRequest = async (req, reply) => {
        const { type, requestId } = req.params; // type = "leave" or "overtime"

        if (!["leave", "overtime"].includes(type)) return reply.code(400).send({ success: false, message: "Invalid type" });

        const table = type === "leave" ? "leave_requests" : "overtime_requests";

        try {
            const result = await pool.query(
                `DELETE FROM ${table} WHERE request_id = $1 RETURNING *`,
                [requestId]
            );

            if (result.rowCount === 0) return reply.code(404).send({ success: false, message: "Request not found" });

            reply.send({ success: true, message: "Request cancelled" });

        } catch (err) {
            console.error("Delete request error:", err);
            reply.code(500).send({ success: false, message: "Failed to cancel request" });
        }
    };

    const getRequests = async (req, reply) => {
        const { id } = req.params;
        const { type } = req.query;

        if (!type || !["leave", "overtime", "off-set"].includes(type)) return reply.code(400).send({ success: false, message: "Invalid request type" });

        const table = type === "leave" ? "leave_requests" : type === "overtime" ? "overtime_requests" : "offset_requests";

        try {
            const { rows } = await pool.query(
                `SELECT * FROM ${table} WHERE employee_id = $1 ORDER BY created_at DESC LIMIT 10`,
                [id]
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
        getNotificationCount,
        resetNotificationCount,
        getEmployeeSchedule,
        saveAvailability,
        sendRequest,
        getRequests,
        getLeaveDays,
        deleteRequest,
        handleRequestAction
    };
}
