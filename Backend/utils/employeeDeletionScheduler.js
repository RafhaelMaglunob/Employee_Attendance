// utils/employeeDeletionScheduler.js
import schedule from 'node-schedule';
import { DateTime } from 'luxon';
import { syncRow, deleteRow } from './syncToSupabase.js'; // your utils

const getDeletionTime = (deletionDate) => {
    if (!deletionDate) return null;
    let dt;
    if (deletionDate instanceof Date) dt = DateTime.fromJSDate(deletionDate, { zone: 'Asia/Manila' });
    else if (typeof deletionDate === 'string') {
        dt = deletionDate.endsWith('Z')
            ? DateTime.fromISO(deletionDate, { zone: 'utc' }).setZone('Asia/Manila')
            : DateTime.fromISO(deletionDate, { zone: 'Asia/Manila' });
    } else return null;

    if (!dt.isValid) return null;
    return dt.set({ hour: 10, minute: 0, second: 0, millisecond: 0 });
};

/**
 * Delete employee: archive locally, delete locally, remove from Supabase
 */
export const deleteEmployeeNow = async (pool, employee) => {
    const deletionDate = employee.effective_deletion_date || employee.end_of_contract;
    const deletionTime = getDeletionTime(deletionDate);
    if (!deletionTime) {
        console.log(`❌ Invalid deletion date for employee ${employee.employee_id}. Skipping.`);
        return;
    }

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        const statusToArchive = employee.effective_deletion_date ? employee.status : "End of Contract";

        // --- 1️⃣ Archive employee ---
        const { rows: archivedEmployees } = await client.query(`
            INSERT INTO employees_archive
            (employee_id, fullname, nickname, email, position, employment_type, status, gender, contact,
             birthday, marital_status, address, sss_number, pagibig, philhealth, current_status)
            SELECT employee_id, fullname, nickname, email, position, employment_type, $2, gender, contact,
                   birthday, marital_status, address, sss_number, pagibig, philhealth, $2
            FROM employees
            WHERE employee_id = $1
            ON CONFLICT (employee_id) DO NOTHING
            RETURNING *
        `, [employee.employee_id, statusToArchive]);

        if (archivedEmployees.length > 0) await syncRow('employees_archive', archivedEmployees[0], 'employee_id');

        // --- 2️⃣ Archive dependents ---
        const { rows: archivedDependents } = await client.query(`
            INSERT INTO employee_dependents_archive
            (employee_id, fullname, relationship, address, contact, city, postalcode, gcash_number)
            SELECT employee_id, fullname, relationship, address, contact, city, postalcode, gcash_number
            FROM employee_dependents
            WHERE employee_id = $1
            RETURNING *
        `, [employee.employee_id]);

        for (const dep of archivedDependents) await syncRow('employee_dependents_archive', dep);

        // --- 3️⃣ Archive documents ---
        const { rows: archivedDocs } = await client.query(`
            INSERT INTO employee_documents_archive
            (document_id, employee_id, sss_id, resume_cv, pagibig, philhealth, barangay_clearance)
            SELECT document_id, employee_id, sss_id, resume_cv, pagibig, philhealth, barangay_clearance
            FROM employee_documents
            WHERE employee_id = $1
            RETURNING *
        `, [employee.employee_id]);

        for (const doc of archivedDocs) await syncRow('employee_documents_archive', doc, 'document_id');

        // --- 4️⃣ Archive contracts ---
        const { rows: contracts } = await client.query('SELECT * FROM employee_contracts WHERE employee_id = $1', [employee.employee_id]);
        if (contracts.length > 0) {
            const { rows: archivedContracts } = await client.query(`
                INSERT INTO employee_contracts_archive
                (contract_id, employee_id, start_of_contract, end_of_contract, contract_type)
                SELECT contract_id, employee_id, start_of_contract, end_of_contract, contract_type
                FROM employee_contracts
                WHERE employee_id = $1
                RETURNING *
            `, [employee.employee_id]);
            for (const c of archivedContracts) await syncRow('employee_contracts_archive', c, 'contract_id');
        }

        // --- 5️⃣ Archive employee account ---
        const { rows: archivedAccounts } = await client.query(`
            INSERT INTO employee_account_archive
            (account_id, employee_id, email, password, must_change_password)
            SELECT account_id, employee_id, email, password, must_change_password
            FROM employee_account
            WHERE employee_id = $1
            RETURNING *
        `, [employee.employee_id]);
        for (const acc of archivedAccounts) await syncRow('employee_account_archive', acc, 'account_id');

        // --- 6️⃣ Delete from main tables locally ---
        const tablesToDelete = [
            'employee_documents',
            'employee_dependents',
            'employee_work_logs',
            'incident_reports',
            'employee_account',
            'employee_attendance',
            'employee_contracts',
            'employees'
        ];
        for (const t of tablesToDelete) await client.query(`DELETE FROM ${t} WHERE employee_id = $1`, [employee.employee_id]);

        await client.query('COMMIT');
        console.log(`✅ Archived and deleted employee locally: ${employee.employee_id}`);

        // --- 7️⃣ Delete from Supabase ---
        await deleteRow('employees', 'employee_id', employee.employee_id);
        await deleteRow('employee_dependents', 'employee_id', employee.employee_id);
        await deleteRow('employee_documents', 'employee_id', employee.employee_id);
        await deleteRow('employee_contracts', 'employee_id', employee.employee_id);
        await deleteRow('employee_account', 'employee_id', employee.employee_id);

        console.log(`✅ Deleted employee from Supabase: ${employee.employee_id}`);

    } catch (err) {
        await client.query('ROLLBACK');
        console.error('❌ Failed to delete employee:', employee.employee_id, err);
    } finally {
        client.release();
    }
};

/**
 * Schedule deletion for a single employee
 */
export const scheduleEmployeeDeletion = async (pool, employee) => {
    const deletionDate = employee.effective_deletion_date || employee.end_of_contract;
    const deletionTime = getDeletionTime(deletionDate);
    if (!deletionTime) {
        console.error(`❌ Invalid deletion date for employee ${employee.employee_id}:`, deletionDate);
        return;
    }

    const jsDate = deletionTime.toJSDate();

    if (deletionTime <= DateTime.now().setZone('Asia/Manila')) {
        console.log(`⏰ Deletion time passed. Deleting employee ${employee.employee_id} now.`);
        await deleteEmployeeNow(pool, employee);
    } else {
        console.log(`⏰ Scheduled deletion for employee ${employee.employee_id} at: ${deletionTime.toFormat('MMMM dd, yyyy HH:mm')}`);
        schedule.scheduleJob(jsDate, async () => {
            await deleteEmployeeNow(pool, employee);
        });
    }
};

/**
 * Start recurring timer to check employees due for deletion
 */
export const startEmployeeDeletionTimer = (pool) => {
    schedule.scheduleJob('*/1 * * * *', async () => {
        const client = await pool.connect();
        try {
            const { rows: employees } = await client.query(`
                SELECT e.employee_id, e.status, e.effective_deletion_date, c.end_of_contract
                FROM employees e
                LEFT JOIN (
                    SELECT DISTINCT ON (employee_id) employee_id, end_of_contract
                    FROM employee_contracts
                    ORDER BY employee_id, updated_at DESC
                ) c ON e.employee_id = c.employee_id
                WHERE e.effective_deletion_date <= CURRENT_DATE
                   OR c.end_of_contract <= CURRENT_DATE
            `);
            for (const emp of employees) await deleteEmployeeNow(pool, emp);
        } catch (err) {
            console.error('❌ Failed to check scheduled deletions:', err);
        } finally {
            client.release();
        }
    });
};

/**
 * Initialize deletion schedules on server startup
 */
export const initEmployeeDeletionSchedules = async (pool) => {
    const client = await pool.connect();
    try {
        // Delete past-due employees immediately
        const { rows: pastEmployees } = await client.query(`
            SELECT e.employee_id, e.status, e.effective_deletion_date, c.end_of_contract
            FROM employees e
            LEFT JOIN (
                SELECT DISTINCT ON (employee_id) employee_id, end_of_contract
                FROM employee_contracts
                ORDER BY employee_id, updated_at DESC
            ) c ON e.employee_id = c.employee_id
            WHERE e.effective_deletion_date <= CURRENT_DATE
               OR c.end_of_contract <= CURRENT_DATE
        `);
        for (const emp of pastEmployees) await deleteEmployeeNow(pool, emp);

        // Schedule future deletions
        const { rows: futureEmployees } = await client.query(`
            SELECT e.employee_id, e.status, e.effective_deletion_date, c.end_of_contract
            FROM employees e
            LEFT JOIN (
                SELECT DISTINCT ON (employee_id) employee_id, end_of_contract
                FROM employee_contracts
                ORDER BY employee_id, updated_at DESC
            ) c ON e.employee_id = c.employee_id
            WHERE e.effective_deletion_date > CURRENT_DATE
               OR c.end_of_contract > CURRENT_DATE
        `);
        for (const emp of futureEmployees) scheduleEmployeeDeletion(pool, emp);

        console.log('✅ Employee deletion schedules initialized.');
    } finally {
        client.release();
    }

    startEmployeeDeletionTimer(pool);
};
