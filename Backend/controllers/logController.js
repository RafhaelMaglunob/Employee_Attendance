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

    const getAllWorkLogs = async (req, reply) => {
        try {
            const result = await pool.query(`
                SELECT 
                    log_id, employee_id, employee_name,
                    to_char(work_date, 'YYYY-MM-DD') AS work_date,
                FROM employee_work_logs
                ORDER BY log_id ASC;
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
                    employee_id,
                    MIN(work_date) AS start_date,
                    MAX(work_date) AS end_date
                FROM employee_work_logs
                GROUP BY employee_id
                ORDER BY employee_id;
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
                    employee_id, 
                    employee_name,
                    CASE
                        WHEN EXTRACT(DAY FROM work_date) BETWEEN 10 AND 24 THEN
                            TO_CHAR(work_date, 'Mon 10-24 YYYY')
                        WHEN EXTRACT(DAY FROM work_date) >= 25 THEN
                            TO_CHAR(work_date, 'Mon 25-') || 
                            TO_CHAR(
                                work_date + INTERVAL '1 month',
                                'Mon 09, YYYY'
                            )
                        WHEN EXTRACT(DAY FROM work_date) <= 9 THEN
                            TO_CHAR(
                                work_date - INTERVAL '1 month',
                                'Mon 25-'
                            ) || TO_CHAR(work_date, 'Mon 09, YYYY')
                    END AS pay_period,
                    COUNT(DISTINCT work_date) AS days_worked,
                    SUM(hours_worked) AS total_hours
                FROM employee_work_logs
                GROUP BY employee_id, employee_name, pay_period
                ORDER BY employee_id, pay_period;

            `);

            return { success: true, data: result.rows };
        } catch (err) {
            console.error("Database Error:", err.message);
            reply.status(500).send({ error: "Database query failed" });
        }
    };

    return {
        getAllAuditLogs,
        getAllWorkLogs,
        getTotalWorkLogs,
        getEmployeePayPeriod
    };
}