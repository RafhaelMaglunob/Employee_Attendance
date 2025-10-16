export function logController(pool) {

    const getAllAuditLogs = async (req, reply) => {
        try {
            const result = await pool.query(`
                SELECT 
                    a.log_id,
                    a.employee_id,
                    e.fullname AS employee_name,
                    a.action,
                    TO_CHAR(a.action_time, 'YYYY-MM-DD HH24:MI:SS') AS action_time,
                    a.remarks
                FROM audit_logs a
                JOIN employees e ON a.employee_id = e.employee_id
                ORDER BY a.log_id ASC;
            `);
            return { success: true, data: result.rows };
        } catch (err) {
            console.error("Database Error:", err.message);
            reply.status(500).send({ error: "Database query failed" });
        }
    };

    const getAllWorkLogs = async (req, reply) => {
        try {
            const result = await pool.query(`
                SELECT 
                    w.log_id,
                    w.employee_id,
                    e.fullname AS employee_name,
                    TO_CHAR(w.work_date, 'YYYY-MM-DD') AS work_date,
                    w.hours_worked
                FROM employee_work_logs w
                JOIN employees e ON w.employee_id = e.employee_id
                ORDER BY w.log_id ASC;
            `);
            return { success: true, data: result.rows };
        } catch (err) {
            console.error("Database Error:", err.message);
            reply.status(500).send({ error: "Database query failed" });
        }
    };

    const getEmployeePayPeriod = async (req, reply) => {
        try {
            const result = await pool.query(`
                SELECT 
                    w.employee_id,
                    e.fullname AS employee_name,
                    MIN(w.work_date) AS start_date,
                    MAX(w.work_date) AS end_date
                FROM employee_work_logs w
                JOIN employees e ON w.employee_id = e.employee_id
                GROUP BY w.employee_id, e.fullname
                ORDER BY w.employee_id;
            `);
            return { success: true, data: result.rows };
        } catch (err) {
            console.error("Database Error:", err.message);
            reply.status(500).send({ error: "Database query failed" });
        }
    };

    const getTotalWorkLogs = async (req, reply) => {
        try {
            const result = await pool.query(`
                SELECT 
                    w.employee_id,
                    e.fullname AS employee_name,
                    CASE
                        WHEN EXTRACT(DAY FROM w.work_date) BETWEEN 10 AND 24 THEN
                            TO_CHAR(w.work_date, 'Mon 10-24 YYYY')
                        WHEN EXTRACT(DAY FROM w.work_date) >= 25 THEN
                            TO_CHAR(w.work_date, 'Mon 25-') || 
                            TO_CHAR(w.work_date + INTERVAL '1 month', 'Mon 09, YYYY')
                        WHEN EXTRACT(DAY FROM w.work_date) <= 9 THEN
                            TO_CHAR(w.work_date - INTERVAL '1 month', 'Mon 25-') || 
                            TO_CHAR(w.work_date, 'Mon 09, YYYY')
                    END AS pay_period,
                    COUNT(DISTINCT w.work_date) AS days_worked,
                    SUM(w.hours_worked) AS total_hours
                FROM employee_work_logs w
                JOIN employees e ON w.employee_id = e.employee_id
                GROUP BY w.employee_id, e.fullname, pay_period
                ORDER BY w.employee_id, pay_period;
            `);
            return { success: true, data: result.rows };
        } catch (err) {
            console.error("Database Error:", err.message);
            reply.status(500).send({ error: "Database query failed" });
        }
    };

    const getSingleWorkLog = async (req, reply) => {
        const { id } = req.params;
        const { pay_period } = req.query;

        try {
            const logRes = await pool.query(`
                SELECT * FROM (
                    SELECT 
                        w.employee_id,
                        e.fullname AS employee_name,
                        CASE
                            WHEN EXTRACT(DAY FROM w.work_date) BETWEEN 10 AND 24 THEN
                                TO_CHAR(w.work_date, 'Mon 10-24 YYYY')
                            WHEN EXTRACT(DAY FROM w.work_date) >= 25 THEN
                                TO_CHAR(w.work_date, 'Mon 25-') || 
                                TO_CHAR(w.work_date + INTERVAL '1 month', 'Mon 09, YYYY')
                            WHEN EXTRACT(DAY FROM w.work_date) <= 9 THEN
                                TO_CHAR(w.work_date - INTERVAL '1 month', 'Mon 25-') || 
                                TO_CHAR(w.work_date, 'Mon 09, YYYY')
                        END AS pay_period,
                        COUNT(DISTINCT w.work_date) AS days_worked,
                        SUM(w.hours_worked) AS total_hours
                    FROM employee_work_logs w
                    JOIN employees e ON w.employee_id = e.employee_id
                    WHERE w.employee_id = $1
                    GROUP BY w.employee_id, e.fullname, pay_period
                ) sub
                WHERE sub.pay_period = $2
                ORDER BY sub.employee_id, sub.pay_period;
            `, [id, pay_period]);

            if (logRes.rows.length === 0)
                return reply.status(404).send({ error: "Work logs not found" });

            return reply.send(logRes.rows[0]);
        } catch (err) {
            console.error("🔴 Database Error:", err);
            reply.status(500).send({ error: err.message });
        }
    };

    const getIncidentLogs = async (req, reply) => {
        const { status } = req.query;
        let params = [];
        let query = `
            SELECT 
                i.incident_id,
                i.employee_id,
                e.fullname AS employee_name,
                i.incident_type,
                TO_CHAR(i.incident_date, 'YYYY-MM-DD') AS incident_date,
                i.status,
                i.witness,
                i.reported_by,
                i.description
            FROM incident_reports i
            JOIN employees e ON i.employee_id = e.employee_id
        `;

        if (status && status.toLowerCase() !== "all") {
            query += " WHERE LOWER(i.status) = $1";
            params.push(status.toLowerCase());
        }

        query += " ORDER BY i.incident_id ASC;";

        try {
            const result = await pool.query(query, params);
            return { success: true, data: result.rows };
        } catch (err) {
            console.error("Database Error:", err.message);
            reply.status(500).send({ error: "Database query failed" });
        }
    };

    return {
        getAllAuditLogs,
        getAllWorkLogs,
        getEmployeePayPeriod,
        getTotalWorkLogs,
        getSingleWorkLog,
        getIncidentLogs,
    };
}
