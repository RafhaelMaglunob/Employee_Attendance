// utils/notificationHelper.js
import { getIo } from "../socket.js";

/**
 * Send notification to employee and increment count
 * @param {Object} pool - Database pool
 * @param {string} employeeId - Target employee ID
 * @param {string} type - Notification type: "leave", "overtime", "off-set", "schedule", "incident", etc.
 * @param {string} action - Action taken: "submitted", "approved", "rejected", "cancelled", "updated", etc.
 * @param {string} message - Notification message
 * @param {Object} client - Optional: existing transaction client
 */
export async function sendNotification(pool, employeeId, type, action, message, client = null) {
    const useClient = client || pool;
    const shouldCommit = !client; // Only commit if we created our own client

    try {
        if (shouldCommit) await useClient.query("BEGIN");

        // Insert notification
        await useClient.query(`
            INSERT INTO notifications (employee_id, type, action, message, is_read)
            VALUES ($1, $2, $3, $4, false)
        `, [employeeId, type, action, message]);

        // Increment count
        await useClient.query(`
            INSERT INTO employee_notifications (employee_id, count)
            VALUES ($1, 1)
            ON CONFLICT (employee_id)
            DO UPDATE SET count = employee_notifications.count + 1
        `, [employeeId]);

        // Get updated count
        const countRes = await useClient.query(`
            SELECT count FROM employee_notifications WHERE employee_id = $1
        `, [employeeId]);
        const notificationCount = countRes.rows[0]?.count || 0;

        if (shouldCommit) await useClient.query("COMMIT");

        // Emit socket event
        const io = getIo();
        io.to(`employee_${employeeId}`).emit("notificationCountUpdated", {
            employee_id: employeeId,
            count: notificationCount,
            message: message,
            type: type,
            action: action
        });

        console.log(`📬 Notification sent to employee_${employeeId}: ${message}`);

        return { success: true, count: notificationCount };
    } catch (err) {
        if (shouldCommit) await useClient.query("ROLLBACK");
        console.error("❌ Send notification error:", err);
        throw err;
    }
}

/**
 * Generate notification message for request updates
 */
export function generateRequestNotificationMessage(requestType, specificType, status, remarks) {
    const typeLabel = requestType === "off-set" ? "Off-set" : 
                     requestType.charAt(0).toUpperCase() + requestType.slice(1);
    
    const statusLabel = status.charAt(0).toUpperCase() + status.slice(1);
    
    let message = `Your ${typeLabel} request`;
    if (specificType) {
        message += ` (${specificType})`;
    }
    message += ` has been ${statusLabel.toLowerCase()}`;
    
    if (remarks) {
        message += `. Admin comment: ${remarks}`;
    }
    
    return message;
}

/**
 * Bulk send notifications to multiple employees
 */
export async function sendBulkNotifications(pool, notifications) {
    const client = await pool.connect();
    try {
        await client.query("BEGIN");

        for (const notif of notifications) {
            await sendNotification(
                pool,
                notif.employeeId,
                notif.type,
                notif.action,
                notif.message,
                client // Use same transaction
            );
        }

        await client.query("COMMIT");
        return { success: true };
    } catch (err) {
        await client.query("ROLLBACK");
        console.error("❌ Bulk notification error:", err);
        throw err;
    } finally {
        client.release();
    }
}