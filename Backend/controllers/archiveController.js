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

    const retrieveEmployee = async (req, reply) => {
        const { id } = req.params;
        const { status } = req.query;

        if (!status) { 
            return reply.status(400).send({ error: "Missing status" });
        }
        
        const client = await pool.connect();
        
        try {
            await client.query('BEGIN');
            const res = await client.query(
                'SELECT 1 FROM employees_archive WHERE employee_id = $1', [id]
            );
            if (res.rowCount === 0) {
                await client.query('ROLLBACK');
                return reply.status(404).send({ error: 'Employee not found in archive' });
            }

            // Archive employee
            await client.query(`
                INSERT INTO employees (
                    employee_id, fullname, nickname, email, position, employment_type, status, gender, contact,
                    birthday, marital_status, address, sss_number, pagibig, philhealth
                )
                SELECT 
                    employee_id, fullname, nickname, email, position, employment_type, $1, gender, contact,
                    birthday, -- already DATE, no conversion needed
                    marital_status, address, sss_number, pagibig, philhealth
                FROM employees_archive
                WHERE employee_id = $2;

            `, [status, id]);
            
            await client.query(`
                INSERT INTO employee_dependents (
                    employee_id, fullname, relationship, address, contact, city, postalcode, gcash_number
                ) 
                SELECT employee_id, fullname, relationship, address, contact, city, postalcode, gcash_number
                FROM employee_dependents_archive WHERE employee_id = $1
            `, [id])

            // Archive documents
            await client.query(`
                INSERT INTO employee_documents (
                    document_id, employee_id, sss_id, resume_cv, pagibig, philhealth, barangay_clearance
                )
                SELECT document_id, employee_id, sss_id, resume_cv, pagibig, philhealth, barangay_clearance
                FROM employee_documents_archive WHERE employee_id = $1
            `, [id]);
            
            await client.query("DELETE FROM employees_archive WHERE employee_id = $1", [id]);

            await client.query('COMMIT');
            reply.send({ message: `Employee ${id} data retrieved successfully` });
        } catch (err) {
            await client.query('ROLLBACK');
            console.error(err);
            reply.status(500).send({ error: "Failed to retrieve employee" });
        } finally {
            client.release();
        }
    };

    return {
        getAllArchives,
        getSingleArchiveEmployee,
        retrieveEmployee,
    };
}
