import { syncRow, deleteRow } from '../utils/syncToSupabase.js';

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
            if (!empRes.rows.length) return reply.status(404).send({ error: "Employee not found in archive" });
            const employee = empRes.rows[0];

            const { rows: dependents } = await pool.query('SELECT * FROM employee_dependents_archive WHERE employee_id = $1', [id]);
            const { rows: contracts } = await pool.query('SELECT * FROM employee_contracts_archive WHERE employee_id = $1', [id]);
            const { rows: documents } = await pool.query('SELECT * FROM employee_documents_archive WHERE employee_id = $1', [id]);

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
        try {
            const conRes = await pool.query(`
                SELECT 
                    TO_CHAR(start_of_contract, 'FMMonth DD, YYYY') as start_of_contract,
                    TO_CHAR(end_of_contract, 'FMMonth DD, YYYY') as end_of_contract
                FROM employee_contracts_archive WHERE employee_id = $1
            `, [id]);
            return { success: true, data: conRes.rows || [] };
        } catch (err) {
            console.error("Database error: ", err.message);
            return reply.status(500).send({ message: "Fetching employee contract failed." });
        }
    };



    /**
     * Retrieve archived employee, restore to main tables, sync to Supabase, and delete archives
     */
    const retrieveEmployee = async (req, reply) => {
        const { id } = req.params;
        const { status } = req.body;
        const client = await pool.connect();

        try {
            await client.query('BEGIN');

            // Fetch archived employee
            const { rows: empRows } = await client.query('SELECT * FROM employees_archive WHERE employee_id = $1', [id]);
            if (!empRows.length) {
                await client.query('ROLLBACK');
                return reply.status(404).send({ error: 'Employee not found in archive' });
            }
            const employee = empRows[0];

            // 1️⃣ Insert employee first
            await client.query(`
                INSERT INTO employees (
                    employee_id, fullname, nickname, email, position, employment_type, status, current_status,
                    gender, contact, birthday, marital_status, address, sss_number, pagibig, philhealth, effective_deletion_date
                ) VALUES (
                    $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,NULL
                )
            `, [
                employee.employee_id, employee.fullname, employee.nickname, employee.email, employee.position,
                employee.employment_type, status, status, employee.gender, employee.contact, employee.birthday,
                employee.marital_status, employee.address, employee.sss_number, employee.pagibig, employee.philhealth
            ]);
            console.log(`✅ Employee restored locally: ${employee.employee_id}`);

            // Sync employee to Supabase
            await syncRow('employees', { ...employee, status }, 'employee_id');
            console.log(`✅ Employee synced to Supabase: ${employee.employee_id}`);

            // 2️⃣ Restore contracts
            const { rows: contracts } = await client.query('SELECT * FROM employee_contracts_archive WHERE employee_id = $1', [id]);
            for (const c of contracts) {
                await client.query(`
                    INSERT INTO employee_contracts (contract_id, employee_id, start_of_contract, end_of_contract, contract_type)
                    VALUES ($1,$2,$3,$4,$5)
                `, [c.contract_id, c.employee_id, c.start_of_contract, c.end_of_contract, c.contract_type]);
                await syncRow('employee_contracts', c, 'contract_id');
                console.log(`✅ Contract synced to Supabase: ${c.contract_id}`);
            }

            // 3️⃣ Restore dependents
            const { rows: dependents } = await client.query('SELECT * FROM employee_dependents_archive WHERE employee_id = $1', [id]);
            for (const d of dependents) {
                await client.query(`
                    INSERT INTO employee_dependents (employee_id, fullname, relationship, address, contact, city, postalcode, gcash_number)
                    VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
                `, [d.employee_id, d.fullname, d.relationship, d.address, d.contact, d.city, d.postalcode, d.gcash_number]);
                await syncRow('employee_dependents', d, 'id'); // use PK for ON CONFLICT
                console.log(`✅ Dependent synced to Supabase: ${d.id}`);
            }

            // 4️⃣ Restore documents
            const { rows: documents } = await client.query('SELECT * FROM employee_documents_archive WHERE employee_id = $1', [id]);
            for (const doc of documents) {
                await client.query(`
                    INSERT INTO employee_documents (employee_id, sss_id, resume_cv, pagibig, philhealth, barangay_clearance, status)
                    VALUES ($1,$2,$3,$4,$5,$6,$7)
                `, [doc.employee_id, doc.sss_id, doc.resume_cv, doc.pagibig, doc.philhealth, doc.barangay_clearance, doc.status]);
                await syncRow('employee_documents', doc, 'document_id'); // use PK for ON CONFLICT
                console.log(`✅ Document synced to Supabase: ${doc.document_id}`);
            }

            // 5️⃣ Delete archives only after everything is restored
            await client.query('DELETE FROM employee_contracts_archive WHERE employee_id = $1', [id]);
            for (const c of contracts) {
                await deleteRow('employee_contracts_archive', 'contract_id', c.contract_id);
            }

            await client.query('DELETE FROM employee_dependents_archive WHERE employee_id = $1', [id]);
            for (const d of dependents) {
                await deleteRow('employee_dependents_archive', 'id', d.id);
            }

            await client.query('DELETE FROM employee_documents_archive WHERE employee_id = $1', [id]);
            for (const doc of documents) {
                await deleteRow('employee_documents_archive', 'document_id', doc.document_id);
            }

            await client.query('DELETE FROM employees_archive WHERE employee_id = $1', [id]);
            await deleteRow('employees_archive', 'employee_id', employee.employee_id);

            console.log(`🗑️ Archives deleted locally and from Supabase for employee: ${id}`);


            await client.query('COMMIT');

            reply.send({ employee, contracts, dependents, documents });

        } catch (err) {
            await client.query('ROLLBACK');
            console.error("Failed to retrieve and restore employee:", err);
            reply.status(500).send({ error: "Failed to retrieve and restore employee" });
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
