    import argon2 from "argon2";
    import jwt from 'jsonwebtoken';
    import { getIo } from "../socket.js";
    import { syncRow, deleteRow } from '../utils/syncToSupabase.js';
    import { emitRequestUpdate, emitRequestDelete, emitNotificationUpdate, emitNotificationCountUpdate } from '../utils/socketHelper.js';

    const TIME_RANGES = {
        Opening: { start_time: '09:00:00', end_time: '14:00:00' },
        Closing: { start_time: '18:00:00', end_time: '23:00:00' },
    };

    const isGoogleDriveLink = (url) => {
        return /^https:\/\/drive\.google\.com\/file\/d\/[a-zA-Z0-9_-]+(\/.*)?$/.test(url);
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

                if (!result.rows.length) return reply.status(404).send({ error: 'Incorrect Email or Password.' });

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

        const addEmployeeDocuments = async (req, reply) => {
            const { id: employeeId } = req.params;
            const { documentType, link } = req.body;
            const io = getIo();

            try {
                // Validation
                if (!documentType || !link) {
                    return reply.status(400).send({
                        success: false,
                        message: 'Document type and link are required'
                    });
                }

                if (!isGoogleDriveLink(link)) {
                    return reply.status(400).send({
                        success: false,
                        message: 'Only Google Drive links are allowed (must start with https://drive.google.com/file/d/)'
                    });
                }

                const client = await pool.connect();
                let document;
                
                try {
                    // Check if document already exists
                    const existingRes = await client.query(
                        'SELECT document_id FROM employee_documents WHERE employee_id = $1 AND document_type = $2',
                        [employeeId, documentType]
                    );

                    if (existingRes.rowCount > 0) {
                        // Update existing
                        const { rows } = await client.query(
                            'UPDATE employee_documents SET link = $1, status = $2, updated_at = NOW() WHERE employee_id = $3 AND document_type = $4 RETURNING *',
                            [link, 'Approved', employeeId, documentType]
                        );
                        document = rows[0];
                    } else {
                        // Insert new
                        const { rows } = await client.query(
                            'INSERT INTO employee_documents (employee_id, document_type, link, status, created_at, updated_at) VALUES ($1, $2, $3, $4, NOW(), NOW()) RETURNING *',
                            [employeeId, documentType, link, 'Approved']
                        );
                        document = rows[0];
                    }

                    // Sync to Supabase
                    await syncRow('employee_documents', document, 'document_id');

                    // Emit Socket.IO event for real-time update
                    io.emit('adminDocumentUpdated', document);
                    io.to(`employee_${employeeId}`).emit('documentUpdated', document);

                } finally {
                    client.release();
                }

                return reply.send({
                    success: true,
                    message: 'Document link saved successfully',
                    document
                });

            } catch (error) {
                console.error('Error saving document:', error);
                return reply.status(500).send({
                    success: false,
                    message: 'Failed to save document link'
                });
            }
        };


        const getEmployeeDocuments = async (req, reply) => {
            const { id: employeeId } = req.params;

            try {
                const client = await pool.connect();
                let documents;
                try {
                    const res = await client.query(
                        'SELECT document_id, document_type, link, status FROM employee_documents WHERE employee_id = $1 ORDER BY document_type',
                        [employeeId]
                    );
                    documents = res.rows;
                } finally {
                    client.release();
                }

                return reply.send({ success: true, documents });

            } catch (error) {
                console.error('Error fetching documents:', error);
                return reply.status(500).send({
                    success: false,
                    message: 'Failed to fetch documents'
                });
            }
        };

        // GET - Check document completion status
        const getDocumentCompletion = async (req, reply) => {
            const { id: employeeId } = req.params;

            try {
                const requiredDocuments = ['SSS ID', 'Resume/CV', 'Pag-Ibig', 'PhilHealth', 'Barangay Clearance'];

                const { rows: documents } = await pool.query(
                    'SELECT document_type, status FROM employee_documents WHERE employee_id = $1',
                    [employeeId]
                );

                const completionStatus = {};
                requiredDocuments.forEach(docType => {
                    const doc = documents.find(d => d.document_type === docType);
                    completionStatus[docType] = doc ? doc.status : 'Incomplete';
                });

                const allComplete = requiredDocuments.every(
                    docType => completionStatus[docType] === 'Approved'
                );

                const totalCompleted = Object.values(completionStatus).filter(s => s === 'Approved').length;

                return reply.send({
                    success: true,
                    allComplete,
                    completionStatus,
                    totalRequired: requiredDocuments.length,
                    totalCompleted
                });

            } catch (error) {
                console.error('Error checking completion:', error);
                return reply.status(500).send({
                    success: false,
                    message: 'Failed to check document completion'
                });
            }
        };

        // PATCH - Remove document link (soft delete)
        const deleteEmployeeDocument = async (req, reply) => {
            const { documentId } = req.params;
            const io = getIo();

            try {
                const client = await pool.connect();
                let document;
                
                try {
                    // Update the link to empty string and status to Incomplete
                    const { rows } = await client.query(
                        `UPDATE employee_documents 
                        SET link = '', status = 'Incomplete', updated_at = NOW() 
                        WHERE document_id = $1 
                        RETURNING *`,
                        [documentId]
                    );

                    if (rows.length === 0) {
                        return reply.status(404).send({
                            success: false,
                            message: 'Document not found'
                        });
                    }

                    document = rows[0];

                    // Sync to Supabase
                    await syncRow('employee_documents', document, 'document_id');

                    // Emit Socket.IO event for real-time update
                    io.emit('adminDocumentDeleted', { document_id: documentId, employee_id: document.employee_id });
                    io.to(`employee_${document.employee_id}`).emit('documentDeleted', { document_id: documentId });

                } finally {
                    client.release();
                }

                return reply.send({
                    success: true,
                    message: 'Document link removed successfully',
                    document
                });

            } catch (error) {
                console.error('Error deleting document:', error);
                return reply.status(500).send({
                    success: false,
                    message: 'Failed to delete document'
                });
            }
        };

        // PUT - Update document status
        const updateDocumentStatus = async (req, reply) => {
            const { documentId } = req.params;
            const { status } = req.body;
            const io = getIo();

            try {
                if (!['Pending', 'Approved', 'Incomplete'].includes(status)) {
                    return reply.status(400).send({
                        success: false,
                        message: 'Invalid status. Must be Pending, Approved, or Incomplete'
                    });
                }

                const client = await pool.connect();
                let document;
                
                try {
                    const { rows } = await client.query(
                        'UPDATE employee_documents SET status = $1, updated_at = NOW() WHERE document_id = $2 RETURNING *',
                        [status, documentId]
                    );

                    if (rows.length === 0) {
                        return reply.status(404).send({
                            success: false,
                            message: 'Document not found'
                        });
                    }

                    document = rows[0];

                    // Sync to Supabase
                    await syncRow('employee_documents', document, 'document_id');

                    // Emit Socket.IO event for real-time update
                    io.emit('adminDocumentUpdated', document);
                    io.to(`employee_${document.employee_id}`).emit('documentUpdated', document);

                } finally {
                    client.release();
                }

                return reply.send({
                    success: true,
                    message: 'Document status updated successfully',
                    document
                });

            } catch (error) {
                console.error('Error updating status:', error);
                return reply.status(500).send({
                    success: false,
                    message: 'Failed to update document status'
                });
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

        const getEmployeeNotifications = async (req, reply) => {
            const { id } = req.params;
            try {
                const result = await pool.query(`
                    SELECT n.*
                    FROM notifications n
                    JOIN employees e ON e.employee_id = n.employee_id
                    WHERE e.employee_id = $1
                    ORDER BY n.created_at DESC
                    LIMIT 50;

                `, [id]);
                
                return { success: true, notifications: result.rows };
            } catch (err) {
                console.error(err);
                return reply.status(500).send({ error: "Failed to fetch notifications" });
            }
        };

        const clearEmployeeNotifications = async (req, reply) => {
            const { id } = req.params; 
            try {
                const delRes = await pool.query(`
                    DELETE FROM notifications 
                    WHERE employee_id = $1 AND is_read = TRUE
                    RETURNING *
                `, [id]);

                reply.send({ success: true, deleted: delRes.rowCount });

                setImmediate(async () => {
                    try {
                        delRes.rows.forEach(row => {
                            syncRow('notifications', row, 'id');
                        });
                    } catch (err) {
                        console.error("Supabase delete error:", err);
                    }
                });
            } catch (err) {
                console.error(err);
                return reply.status(500).send({ error: "Failed to clear notifications" });
            }
        };


        const marKNotificationRead = async (req, reply) => {
            const io = getIo();
            const { id } = req.params;
            
            try {
            const updRes = await pool.query(
                `UPDATE notifications SET is_read = TRUE WHERE id = $1 RETURNING *`,
                [id]
            );
            
            const updated_notification = updRes.rows[0];
            
            if (updated_notification) {
                // ✅ REAL-TIME - Notify the employee
                emitNotificationUpdate(io, updated_notification.employee_id, updated_notification);
            }

            reply.send({ success: true, notification: updated_notification });

            // Sync to Supabase
            setImmediate(async () => {
                try {
                await syncRow('notifications', updated_notification, 'id');
                } catch (err) {
                console.error("Supabase sync error:", err);
                }
            });

            } catch (err) {
                console.error(err);
                return reply.status(500).send({ error: "Failed to mark notification" });
            }
        };

        const resetNotificationCount = async (req, reply) => {
            const io = getIo();
            const { id } = req.params;

            try {
            const res = await pool.query(
                "UPDATE employee_notifications SET count = 0 WHERE employee_id = $1 RETURNING *",
                [id]
            );

            if (res.rowCount === 0) {
                return reply.send({ success: true, count: 0 });
            }

            // ✅ REAL-TIME - Update notification count
            emitNotificationCountUpdate(io, id, 0);

            return reply.send({ success: true, count: 0 });
            } catch (err) {
            console.error("Error resetting notification count:", err);
            return reply.status(500).send({ success: false, message: "Failed to reset count" });
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

                const { rows: emp } = await pool.query(`SELECT fullname FROM employees WHERE employee_id = $1`, [id]);
                
                const payload = {
                    ...insertedRow,
                    request_type,
                    employee_name: emp[0]?.fullname || "",
                    link: insertedRow.attach_link,
                    status: insertedRow.status?.toLowerCase() || 'pending'
                };
                emitRequestUpdate(io, payload);

                // Sync to Supabase
                setImmediate(async () => {
                    try {
                    await syncRow(table, insertedRow, "request_id");
                    } catch (err) {
                    console.warn("Supabase sync error:", err);
                    }
                });

                return reply.code(201).send({ success: true, message: "Request submitted", data: payload });

            } catch (err) {
                console.error("Error submitting request:", err);
                return reply.code(500).send({ success: false, message: "Error submitting request" });
            }
        };

        const deleteRequest = async (req, reply) => {
            const io = getIo();
            const { requestId } = req.params;

            try {
            // Find the request first to get type and employee_id
            const queries = [
                { table: 'leave_requests', type: 'leave' },
                { table: 'overtime_requests', type: 'overtime' },
                { table: 'offset_requests', type: 'off-set' }
            ];

            let found = null;
            for (const q of queries) {
                const res = await pool.query(
                `SELECT employee_id, * FROM ${q.table} WHERE request_id = $1`,
                [requestId]
                );
                if (res.rows.length > 0) {
                found = { ...res.rows[0], table: q.table, type: q.type };
                break;
                }
            }

            if (!found) {
                return reply.code(404).send({ success: false, message: "Request not found" });
            }

            // Delete
            await pool.query(`DELETE FROM ${found.table} WHERE request_id = $1`, [requestId]);

            // ✅ REAL-TIME DELETE - Notify employee and admins
            emitRequestDelete(io, requestId, found.type, found.employee_id);

            // Sync deletion
            setImmediate(async () => {
                try {
                await deleteRow(found.table, "request_id", requestId);
                } catch (err) {
                console.error("Supabase delete error:", err);
                }
            });

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
        
        const getEmployeeTimeLogs = async (req, reply) => {
            const { id } = req.params;
            const { date } = req.query; // Optional: specific date, defaults to today

            try {
                const targetDate = date || new Date().toISOString().split('T')[0];

                // Get week boundaries (Monday to Sunday)
                const weekBoundaries = await pool.query(`
                    SELECT 
                        DATE_TRUNC('week', $1::date) + INTERVAL '1 day' AS week_start,
                        DATE_TRUNC('week', $1::date) + INTERVAL '7 days' AS week_end
                `, [targetDate]);

                const { week_start, week_end } = weekBoundaries.rows[0];

                // Fetch today's logs AND weekly total in one query
                const result = await pool.query(`
                    SELECT 
                        TO_CHAR(clock_in, 'HH12:MI AM') AS clock_in,
                        TO_CHAR(clock_out, 'HH12:MI AM') AS clock_out,
                        total_hours,
                        (SELECT COALESCE(SUM(total_hours), 0) 
                        FROM employee_attendance 
                        WHERE employee_id = $1 
                        AND attend_date BETWEEN $3::date AND $4::date
                        AND status = 'Present') AS weekly_total
                    FROM employee_attendance
                    WHERE employee_id = $1 
                    AND attend_date = $2
                    LIMIT 1
                `, [id, targetDate, week_start, week_end]);

                const logs = {
                    clock_in: result.rows[0]?.clock_in || null,
                    clock_out: result.rows[0]?.clock_out || null,
                    total_hours: result.rows[0]?.total_hours || 0,
                    weekly_total: parseFloat(result.rows[0]?.weekly_total || 0).toFixed(2)
                };

                return reply.send({ success: true, logs });

            } catch (error) {
                console.error('Error fetching time logs:', error);
                return reply.status(500).send({
                    success: false,
                    message: 'Failed to fetch time logs'
                });
            }
        };

        // GET /employee/attendance-data/:id - Get ALL attendance records for calculations
        const getEmployeeAttendanceData = async (req, reply) => {
            const { id } = req.params;

            try {
                // Fetch ALL attendance records for this employee
                const result = await pool.query(`
                    SELECT 
                        attendance_id,
                        employee_id,
                        attend_date AS date,
                        TO_CHAR(clock_in, 'HH12:MI AM') AS clock_in,
                        TO_CHAR(clock_out, 'HH12:MI AM') AS clock_out,
                        total_hours AS hours_worked,
                        status
                    FROM employee_attendance
                    WHERE employee_id = $1
                    ORDER BY attend_date DESC
                `, [id]);

                return reply.send({ 
                    success: true, 
                    data: result.rows 
                });

            } catch (error) {
                console.error('Error fetching attendance data:', error);
                return reply.status(500).send({
                    success: false,
                    message: 'Failed to fetch attendance data'
                });
            }
        };

        const updateEmployeeAvailability = async (req, reply) => {
            const { id } = req.params;
            const { availability_disabled } = req.body;

            try {
                // First, check if employee is full-time
                const employeeCheck = await pool.query(
                    `SELECT employment_type FROM employees WHERE employee_id = $1`,
                    [id]
                );

                if (!employeeCheck.rows.length) {
                    return reply.status(404).send({
                        success: false,
                        message: 'Employee not found'
                    });
                }

                if (employeeCheck.rows[0].employment_type !== 'Full-Time') {
                    return reply.status(400).send({
                        success: false,
                        message: 'Only full-time employees can toggle auto-scheduling'
                    });
                }

                // Update the availability_disabled flag
                const result = await pool.query(
                    `UPDATE employees 
                    SET availability_disabled = $1 
                    WHERE employee_id = $2 
                    RETURNING *`,
                    [availability_disabled, id]
                );

                const updatedEmployee = result.rows[0];

                // Send response first
                reply.send({
                    success: true,
                    message: availability_disabled 
                        ? 'Auto-scheduling disabled' 
                        : 'Auto-scheduling enabled',
                    availability_disabled: updatedEmployee.availability_disabled
                });

                // Background sync
                setImmediate(async () => {
                    try {
                        await syncRow('employees', updatedEmployee, 'employee_id');
                    } catch (err) {
                        console.error("❌ Supabase sync error (employees):", err.message);
                    }
                });

            } catch (error) {
                console.error('Error updating availability:', error);
                return reply.status(500).send({
                    success: false,
                    message: 'Failed to update availability setting'
                });
            }
        };

        return {
            getLoginEmployeeAccount,
            changeEmployeePassword,
            addEmployeeDocuments,
            getNotificationCount,
            resetNotificationCount,
            getEmployeeSchedule,
            saveAvailability,
            sendRequest,
            getRequests,
            getLeaveDays,
            deleteRequest,
            handleRequestAction,
            getEmployeeNotifications,
            clearEmployeeNotifications,
            marKNotificationRead,
            addEmployeeDocuments,
            getEmployeeDocuments,
            getDocumentCompletion,
            deleteEmployeeDocument,
            updateDocumentStatus,
            getEmployeeTimeLogs,
            getEmployeeAttendanceData,
            updateEmployeeAvailability
        };
    }
