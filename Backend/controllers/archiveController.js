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
            reply.status(500).send({ error: "Failed to fetch all archive" });
        }
    };

    const getSingleArchiveEmployee = async (req, reply) => {
        const { id } = req.params;
        try {
            const empRes = await pool.query('SELECT * FROM employees_archive WHERE employee_id = $1', [id]);
            if (empRes.rows.length === 0) return reply.status(404).send({ error: "Employee not found in archive" });
            const employee = empRes.rows[0];

            const { rows: dependents } = await pool.query('SELECT * FROM employee_dependents_archive WHERE employee_id = $1', [id]);
            const { rows: contracts } = await pool.query('SELECT * FROM employee_contracts_archive WHERE employee_id = $1', [id]);
            const { rows: documents } = await pool.query('SELECT * FROM employee_documents_archive WHERE employee_id = $1', [id]);

            // If you want only one dependent for the form (emergency), use first dependent
            const primaryDependent = dependents[0] || {};

            return reply.send({
                ...employee,
                emergency_name: primaryDependent.fullname || null,
                relationship: primaryDependent.relationship || null,
                emergency_address: primaryDependent.address || null,
                emergency_contact: primaryDependent.contact || null,
                city: primaryDependent.city || null,
                postal_code: primaryDependent.postalcode || null,
                gcash_no: primaryDependent.gcash_number || null,
                contracts,
                dependents,
                documents
            });
        } catch (err) {
            console.error("Database Error:", err.message);
            reply.status(500).send({ error: "Failed to fetch target archive" });
        }
    };

    const getSingleArchiveContract = async (req, reply) => {
        const { id } = req.params;

        try{
            const conRes = await pool.query(`
                SELECT 
                TO_CHAR(start_of_contract, 'FMMonth DD, YYYY') as start_of_contract,
                TO_CHAR(end_of_contract, 'FMMonth DD, YYYY') as end_of_contract
                FROM employee_contracts_archive WHERE employee_id = $1
                `, [id])
            const contract = conRes.rows || {};

            return ({ success: true, data: contract});
        }
        catch(err) {
            console.error("Database error: ", err.message)
            return reply.status(500).send({ message: "Fetching employee contract failed."})
        }
    }

    const retrieveEmployee = async (req, reply) => {
        const { id } = req.params;
        const { status } = req.body;

        const client = await pool.connect();
        try {
            await client.query('BEGIN');

            // Check archive existence
            const { rowCount: empCount } = await client.query(
                'SELECT 1 FROM employees_archive WHERE employee_id = $1', [id]
            );
            if (empCount === 0) {
                await client.query('ROLLBACK');
                return reply.status(404).send({ error: 'Employee not found in archive' });
            }

            // Move employee
            await client.query(`
                INSERT INTO employees (
                    employee_id, fullname, nickname, email, position, employment_type, status, current_status,
                    gender, contact, birthday, marital_status, address, sss_number, pagibig, philhealth
                )
                SELECT 
                    employee_id, fullname, nickname, email, position, employment_type, $1, $1,
                    gender, contact, birthday, marital_status, address, sss_number, pagibig, philhealth
                FROM employees_archive
                WHERE employee_id = $2
                ON CONFLICT (employee_id) DO NOTHING
            `, [status, id]);

            // Move contracts
            await client.query(`
                INSERT INTO employee_contracts (
                    employee_id, start_of_contract, end_of_contract, contract_type
                )
                SELECT employee_id, start_of_contract, end_of_contract, contract_type
                FROM employee_contracts_archive
                WHERE employee_id = $1
            `, [id]);

            // Move dependents
            await client.query(`
                INSERT INTO employee_dependents (
                    employee_id, fullname, relationship, address, contact, city, postalcode, gcash_number
                )
                SELECT employee_id, fullname, relationship, address, contact, city, postalcode, gcash_number
                FROM employee_dependents_archive
                WHERE employee_id = $1
            `, [id]);

            // Move documents
            await client.query(`
                INSERT INTO employee_documents (
                    employee_id, sss_id, resume_cv, pagibig, philhealth, barangay_clearance, status
                )
                SELECT employee_id, sss_id, resume_cv, pagibig, philhealth, barangay_clearance, status
                FROM employee_documents_archive
                WHERE employee_id = $1
            `, [id]);

            // **Delete from archive tables** AFTER moving
            await client.query('DELETE FROM employee_contracts_archive WHERE employee_id = $1', [id]);
            await client.query('DELETE FROM employee_dependents_archive WHERE employee_id = $1', [id]);
            await client.query('DELETE FROM employee_documents_archive WHERE employee_id = $1', [id]);
            await client.query('DELETE FROM employees_archive WHERE employee_id = $1', [id]);

            await client.query('COMMIT');

            // Return full employee data
            const { rows: [employee] } = await client.query('SELECT * FROM employees WHERE employee_id = $1', [id]);
            const { rows: contracts } = await client.query('SELECT * FROM employee_contracts WHERE employee_id = $1', [id]);
            const { rows: dependents } = await client.query('SELECT * FROM employee_dependents WHERE employee_id = $1', [id]);
            const { rows: documents } = await client.query('SELECT * FROM employee_documents WHERE employee_id = $1', [id]);

            reply.send({ ...employee, contracts, dependents, documents });

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
        getSingleArchiveContract,
        retrieveEmployee,
    };
}
