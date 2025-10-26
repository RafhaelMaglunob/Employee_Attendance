// utils/employeeRestore.js
import { syncRow, deleteRow } from './syncToSupabase.js';
import { sendEmployeeActivatedEmail } from './sendEmail.js';

export const restoreEmployeeNow = async (pool, employeeId, options = {}) => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // 1️⃣ Restore employee
        const { rows: archivedEmployees } = await client.query(`
            SELECT *
            FROM employees_archive
            WHERE employee_id = $1
        `, [employeeId]);

        if (!archivedEmployees.length) {
            console.log(`❌ No archived employee found for ${employeeId}`);
            await client.query('ROLLBACK');
            return;
        }

        const employee = archivedEmployees[0];

        await client.query(`
            INSERT INTO employees (
                employee_id, fullname, nickname, email, position, employment_type,
                status, current_status, gender, contact, birthday, marital_status,
                address, sss_number, pagibig, philhealth
            ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)
            ON CONFLICT (employee_id) DO UPDATE
            SET fullname = EXCLUDED.fullname,
                nickname = EXCLUDED.nickname,
                email = EXCLUDED.email,
                position = EXCLUDED.position,
                employment_type = EXCLUDED.employment_type,
                status = EXCLUDED.status,
                current_status = EXCLUDED.current_status,
                gender = EXCLUDED.gender,
                contact = EXCLUDED.contact,
                birthday = EXCLUDED.birthday,
                marital_status = EXCLUDED.marital_status,
                address = EXCLUDED.address,
                sss_number = EXCLUDED.sss_number,
                pagibig = EXCLUDED.pagibig,
                philhealth = EXCLUDED.philhealth
        `, [
            employee.employee_id, employee.fullname, employee.nickname, employee.email,
            employee.position, employee.employment_type, employee.status, employee.current_status,
            employee.gender, employee.contact, employee.birthday, employee.marital_status,
            employee.address, employee.sss_number, employee.pagibig, employee.philhealth
        ]);

        await syncRow('employees', employee, 'employee_id');

        // 2️⃣ Restore user account
        const { rows: archivedAccounts } = await client.query(`
            SELECT *
            FROM users_archive
            WHERE employee_id = $1
        `, [employeeId]);

        if (archivedAccounts.length > 0) {
            const account = archivedAccounts[0];
            await client.query(`
                INSERT INTO users (employee_id, fullname, email, password, role, must_change_password)
                VALUES ($1,$2,$3,$4,$5,$6)
                ON CONFLICT (account_id) DO UPDATE
                SET fullname = EXCLUDED.fullname,
                    email = EXCLUDED.email,
                    password = EXCLUDED.password,
                    role = EXCLUDED.role,
                    must_change_password = EXCLUDED.must_change_password
            `, [
                account.employee_id, account.fullname, account.email,
                account.password, account.role, account.must_change_password
            ]);
            await syncRow('users', account, 'account_id');
        }

        // 3️⃣ Restore contracts
        const { rows: archivedContracts } = await client.query(`
            SELECT *
            FROM employee_contracts_archive
            WHERE employee_id = $1
        `, [employeeId]);

        await Promise.all(archivedContracts.map(c =>
            client.query(`
                INSERT INTO employee_contracts (contract_id, employee_id, start_of_contract, end_of_contract, contract_type)
                VALUES ($1,$2,$3,$4,$5)
                ON CONFLICT (contract_id) DO UPDATE
                SET start_of_contract = EXCLUDED.start_of_contract,
                    end_of_contract = EXCLUDED.end_of_contract,
                    contract_type = EXCLUDED.contract_type
            `, [c.contract_id, c.employee_id, c.start_of_contract, c.end_of_contract, c.contract_type])
            .then(() => syncRow('employee_contracts', c, 'contract_id'))
        ));

        // 4️⃣ Restore dependents
        const { rows: archivedDependents } = await client.query(`
            SELECT *
            FROM employee_dependents_archive
            WHERE employee_id = $1
        `, [employeeId]);

        await Promise.all(archivedDependents.map(d =>
            client.query(`
                INSERT INTO employee_dependents (employee_id, fullname, relationship, address, contact, city, postalcode, gcash_number)
                VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
            `, [d.employee_id, d.fullname, d.relationship, d.address, d.contact, d.city, d.postalcode, d.gcash_number])
            .then(() => syncRow('employee_dependents', d))
        ));

        // 5️⃣ Restore documents
        const { rows: archivedDocs } = await client.query(`
            SELECT *
            FROM employee_documents_archive
            WHERE employee_id = $1
        `, [employeeId]);

        await Promise.all(archivedDocs.map(doc =>
            client.query(`
                INSERT INTO employee_documents (document_id, employee_id, sss_id, resume_cv, pagibig, philhealth, barangay_clearance)
                VALUES ($1,$2,$3,$4,$5,$6,$7)
                ON CONFLICT (document_id) DO UPDATE
                SET sss_id = EXCLUDED.sss_id,
                    resume_cv = EXCLUDED.resume_cv,
                    pagibig = EXCLUDED.pagibig,
                    philhealth = EXCLUDED.philhealth,
                    barangay_clearance = EXCLUDED.barangay_clearance
            `, [doc.document_id, doc.employee_id, doc.sss_id, doc.resume_cv, doc.pagibig, doc.philhealth, doc.barangay_clearance])
            .then(() => syncRow('employee_documents', doc, 'document_id'))
        ));

        // 6️⃣ Remove from archive
        await Promise.all([
            deleteRow('employees_archive', 'employee_id', employeeId),
            deleteRow('users_archive', 'employee_id', employeeId),
            deleteRow('employee_contracts_archive', 'employee_id', employeeId),
            deleteRow('employee_dependents_archive', 'employee_id', employeeId),
            deleteRow('employee_documents_archive', 'employee_id', employeeId)
        ]);

        await client.query('COMMIT');
        await sendEmployeeActivatedEmail(employee.email, employee.fullname);
        console.log(`✅ Employee restored: ${employee.employee_id}`);

    } catch (err) {
        await client.query('ROLLBACK');
        console.error(`❌ Failed to restore employee ${employeeId}:`, err);
    } finally {
        client.release();
    }
};
