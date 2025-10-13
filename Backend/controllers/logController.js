export function logController(pool) {

    const getAllAuditLogs = async (req, reply) => {
        try {
            const result = await pool.query(`
                SELECT log_id, employee_id, employee_name, action,
                    to_char(action_time, 'YYYY-MM-DD HH24:MI:SS') AS action_time,
                    remarks
                FROM audit_logs
                ORDER BY log_id ASC;
            `);
            return { success: true, data: result.rows };
        } catch (err) {
            console.error("Database Error:", err.message);
            reply.status(500).send({ error: "Database query failed" });
        }
    };

    return {
        getAllAuditLogs,
    };
}