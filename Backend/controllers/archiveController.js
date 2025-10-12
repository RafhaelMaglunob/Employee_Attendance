export function archiveController(pool) {
    const getAllArchives = async (req, reply) => {
        try {
            const result = await pool.query(`
                SELECT *,
                CASE
                    WHEN fullname IS NOT NULL
                    AND nickname IS NOT NULL
                    AND email IS NOT NULL
                    AND position IS NOT NULL
                    AND employment_type IS NOT NULL
                    AND gender IS NOT NULL
                    AND contact IS NOT NULL
                    AND marital_status IS NOT NULL
                    AND birthday IS NOT NULL
                    AND address IS NOT NULL
                    AND sss_number IS NOT NULL
                    AND pagibig IS NOT NULL
                    AND philhealth IS NOT NULL
                    THEN true
                    ELSE false
                END AS documents_complete_archive
                FROM employees_archive
                ORDER BY employee_id ASC;
            `);
            return { success: true, data: result.rows };
        } catch (err) {
            console.error("Database Error:", err.message);
            reply.status(500).send({ error: "Database query failed" });
        }
    };
    
    const getSingleArchiveEmployee = async (req, reply) => {
        const { id } = req.params;
        try {
            // Fetch employee from archive
            const empRes = await pool.query('SELECT * FROM employees_archive WHERE employee_id = $1', [id]);
            if (empRes.rows.length === 0) return reply.status(404).send({ error: "Employee not found in archive" });
            const employee = empRes.rows[0];

            // Fetch dependent from archive
            const depRes = await pool.query('SELECT * FROM employee_dependents_archive WHERE employee_id = $1', [id]);
            const dependent = depRes.rows[0] || {};

            // Return combined data
            return reply.send({
                ...employee,
                emergency_name: dependent.fullname || null,
                relationship: dependent.relationship || null,
                emergency_address: dependent.address || null,
                emergency_contact: dependent.contact || null,
                city: dependent.city || null,
                postal_code: dependent.postal_code || null,
                gcash_no: dependent.gcash_no || null
            });
        } catch (err) {
            console.error("Database Error:", err.message);
            reply.status(500).send({ error: "Database query failed" });
        }
    };


    return {
        getAllArchives,
        getSingleArchiveEmployee
    };
}
