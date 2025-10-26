import schedule from 'node-schedule';
import { DateTime } from 'luxon';
import { syncRow, deleteRow } from './syncToSupabase.js';
import { sendDeactivationScheduledEmail, sendEmployeeDeactivatedEmail } from './sendEmail.js';

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

export const deleteEmployeeNow = async (pool, employee) => {
    if (['Employed', 'Probationary'].includes(employee.status)) return;

    const deletionDate = employee.effective_deletion_date || employee.end_of_contract;
    const deletionTime = getDeletionTime(deletionDate);
    if (!deletionTime) return;

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        const statusToArchive = employee.effective_deletion_date ? employee.status : "End of Contract";
          const { rowCount } = await client.query(`
            UPDATE employee_contracts
            SET end_of_contract = NOW()
            WHERE employee_id = $1
            AND (end_of_contract IS NULL OR end_of_contract > NOW())
            AND LOWER(contract_type) = 'full-time'
        `, [employee.employee_id]);
        console.log(`✅ Updated ${rowCount} full-time contracts with end_of_contract = NOW() for employee ${employee.employee_id}`);

        // --- Archive employees ---
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
        if (archivedEmployees.length > 0) {
            try { await syncRow('employees_archive', archivedEmployees[0], 'employee_id'); }
            catch (err) { console.error(`Supabase sync failed for employees_archive ${employee.employee_id}:`, err); }
        }

        // --- Archive dependents ---
        const { rows: archivedDependents } = await client.query(`
            INSERT INTO employee_dependents_archive
            (employee_id, fullname, relationship, address, contact, city, postalcode, gcash_number)
            SELECT employee_id, fullname, relationship, address, contact, city, postalcode, gcash_number
            FROM employee_dependents
            WHERE employee_id = $1
            RETURNING *
        `, [employee.employee_id]);
        for (const dep of archivedDependents) {
            try { await syncRow('employee_dependents_archive', dep, 'id'); }
            catch (err) { console.error(`Supabase sync failed for employee_dependents_archive ${dep.id}:`, err); }
        }

        // --- Archive documents ---
        const { rows: archivedDocs } = await client.query(`
            INSERT INTO employee_documents_archive
            (document_id, employee_id, sss_id, resume_cv, pagibig, philhealth, barangay_clearance)
            SELECT document_id, employee_id, sss_id, resume_cv, pagibig, philhealth, barangay_clearance
            FROM employee_documents
            WHERE employee_id = $1
            RETURNING *
        `, [employee.employee_id]);
        for (const doc of archivedDocs) {
            try { await syncRow('employee_documents_archive', doc, 'document_id'); }
            catch (err) { console.error(`Supabase sync failed for employee_documents_archive ${doc.document_id}:`, err); }
        }

        // --- Archive contracts ---
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
            for (const c of archivedContracts) {
                try { await syncRow('employee_contracts_archive', c, 'contract_id'); }
                catch (err) { console.error(`Supabase sync failed for employee_contracts_archive ${c.contract_id}:`, err); }
            }
        }

        // --- Archive users ---
        const { rows: archivedAccounts } = await client.query(`
            INSERT INTO users_archive
            (account_id, employee_id, fullname, role, email, password, must_change_password)
            SELECT account_id, employee_id, fullname, role, email, password, must_change_password
            FROM users
            WHERE employee_id = $1
            RETURNING *
        `, [employee.employee_id]);
        for (const acc of archivedAccounts) {
            try { await syncRow('users_archive', acc, 'account_id'); }
            catch (err) { console.error(`Supabase sync failed for users_archive ${acc.account_id}:`, err); }
        }

        // --- Archive attendance ---
        const { rows: archivedAttendance } = await client.query(`
            INSERT INTO employee_attendance_archive
            (attendance_id, employee_id, attend_date, clock_in, clock_out, total_hours, status)
            SELECT attendance_id, employee_id, attend_date, clock_in, clock_out, total_hours, status
            FROM employee_attendance
            WHERE employee_id = $1
            RETURNING *
        `, [employee.employee_id]);
        for (const att of archivedAttendance) {
            try { await syncRow('employee_attendance_archive', att, 'attendance_id'); }
            catch (err) { console.error(`Supabase sync failed for employee_attendance_archive ${att.attendance_id}:`, err); }
        }

        // --- Archive incident reports ---
        const { rows: archivedIncidents } = await client.query(`
            INSERT INTO incident_reports_archive
            (incident_id, employee_id, incident_type, incident_date, witness, reported_by, description, status)
            SELECT incident_id, employee_id, incident_type, incident_date, witness, reported_by, description, status
            FROM incident_reports
            WHERE employee_id = $1
            RETURNING *
        `, [employee.employee_id]);
        for (const ir of archivedIncidents) {
            try { await syncRow('incident_reports_archive', ir, 'incident_id'); }
            catch (err) { console.error(`Supabase sync failed for incident_reports_archive ${ir.incident_id}:`, err); }
        }

        // --- Delete main tables locally ---
        const tablesToDelete = [
            'employee_documents',
            'employee_dependents',
            'employee_work_logs',
            'incident_reports',
            'users',
            'employee_attendance',
            'employee_contracts',
            'employees'
        ];
        for (const t of tablesToDelete) await client.query(`DELETE FROM ${t} WHERE employee_id = $1`, [employee.employee_id]);

        await client.query('COMMIT');

        console.log(`✅ Employee ${employee.employee_id} archived and deleted successfully.`);

        if (employee.email) {
            try {
                await sendEmployeeDeactivatedEmail(employee.email, employee.fullname);
            } catch (err) {
                console.error(`❌ Failed to send deactivation email to ${employee.email}:`, err);
            }
        }
        // --- Delete from Supabase ---
        const supabaseTables = [
            'employees',
            'employee_dependents',
            'employee_documents',
            'employee_contracts',
            'users',
            'employee_attendance',
            'incident_reports'
        ];
        for (const t of supabaseTables) {
            try { await deleteRow(t, 'employee_id', employee.employee_id); }
            catch (err) { console.error(`Supabase delete failed for table ${t}, employee ${employee.employee_id}:`, err); }
        }

    } catch (err) {
        await client.query('ROLLBACK');
        console.error('Failed to delete employee locally:', employee.employee_id, err);
    } finally {
        client.release();
    }
};

export const scheduleEmployeeDeletion = async (pool, employee) => {
    if (['Employed', 'Probationary'].includes(employee.status)) return;

    const deletionDate = employee.effective_deletion_date || employee.end_of_contract;
    const deletionTime = getDeletionTime(deletionDate);
    if (!deletionTime) return;

    const jsDate = deletionTime.toJSDate();
    if (deletionTime <= DateTime.now().setZone('Asia/Manila')) {
        await deleteEmployeeNow(pool, employee);
    } else {
        schedule.scheduleJob(jsDate, async () => {
            await deleteEmployeeNow(pool, employee);
            if (employee.email) {
                try {
                    await sendDeactivationScheduledEmail(employee.email, employee.fullname, jsDate);
                } catch (err) {
                    console.error(`❌ Failed to send scheduled deactivation email to ${employee.email}:`, err);
                }
            }
        });
    }
};

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
                WHERE ( (e.effective_deletion_date IS NOT NULL AND e.effective_deletion_date <= CURRENT_DATE)
                    OR (c.end_of_contract IS NOT NULL AND c.end_of_contract <= CURRENT_DATE) )
                  AND e.status NOT IN ('Employed', 'Probationary')
            `);
            for (const emp of employees) await deleteEmployeeNow(pool, emp);
        } finally {
            client.release();
        }
    });
};

export const initEmployeeDeletionSchedules = async (pool) => {
    const client = await pool.connect();
    try {
        const { rows: futureEmployees } = await client.query(`
            SELECT e.employee_id, e.status, e.effective_deletion_date, c.end_of_contract
            FROM employees e
            LEFT JOIN (
                SELECT DISTINCT ON (employee_id) employee_id, end_of_contract
                FROM employee_contracts
                ORDER BY employee_id, updated_at DESC
            ) c ON e.employee_id = c.employee_id
            WHERE (e.effective_deletion_date > CURRENT_DATE OR c.end_of_contract > CURRENT_DATE)
              AND e.status NOT IN ('Employed', 'Probationary')
        `);
        
        for (const emp of futureEmployees) scheduleEmployeeDeletion(pool, emp);
    } finally {
        client.release();
    }

    startEmployeeDeletionTimer(pool);
};
