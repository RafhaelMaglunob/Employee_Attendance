import schedule from 'node-schedule';
import { DateTime } from 'luxon';
import { syncRow, restoreRow } from './syncToSupabase.js';
import { sendRestorationScheduledEmail, sendEmployeeActivatedEmail } from './sendEmail.js';

/** Convert a date to Manila 10:00 AM */
const getRestorationTime = (date) => {
    if (!date) return null;
    const dt = date instanceof Date
        ? DateTime.fromJSDate(date, { zone: 'Asia/Manila' })
        : DateTime.fromISO(date, { zone: 'Asia/Manila' });
    return dt.isValid ? dt.set({ hour: 10, minute: 0, second: 0, millisecond: 0 }) : null;
};

/** Restore employee immediately */
export const restoreEmployeeNow = async (pool, employee) => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        const statusToRestore = employee.status || 'Employed';

        // 1️⃣ Restore main employee
        const restoredEmployeeResult = await client.query(`
            INSERT INTO employees
            (employee_id, fullname, nickname, email, position, employment_type, status, gender, contact,
             birthday, marital_status, address, sss_number, pagibig, philhealth, current_status, is_restored)
            SELECT employee_id, fullname, nickname, email, position, employment_type, $2, gender, contact,
                   birthday, marital_status, address, sss_number, pagibig, philhealth, $2, TRUE
            FROM employees_archive
            WHERE employee_id = $1
            ON CONFLICT (employee_id) DO UPDATE
            SET is_restored = TRUE, status = EXCLUDED.status, current_status = EXCLUDED.current_status
            RETURNING *
        `, [employee.employee_id, statusToRestore]);

        if (restoredEmployeeResult.rows.length > 0) {
            await syncRow('employees', restoredEmployeeResult.rows[0], 'employee_id');
        }

        // 2️⃣ Restore dependents (requires employee exists)
        const restoredDeps = await client.query(`
            INSERT INTO employee_dependents
            (employee_id, fullname, relationship, address, contact, city, postalcode, gcash_number)
            SELECT employee_id, fullname, relationship, address, contact, city, postalcode, gcash_number
            FROM employee_dependents_archive
            WHERE employee_id = $1
            ON CONFLICT (id) DO NOTHING
            RETURNING *
        `, [employee.employee_id]);
        await Promise.all(restoredDeps.rows.map(dep => syncRow('employee_dependents', dep)));

        // 3️⃣ Restore documents
        const restoredDocs = await client.query(`
            INSERT INTO employee_documents
            (document_id, employee_id, sss_id, resume_cv, pagibig, philhealth, barangay_clearance)
            SELECT document_id, employee_id, sss_id, resume_cv, pagibig, philhealth, barangay_clearance
            FROM employee_documents_archive
            WHERE employee_id = $1
            RETURNING *
        `, [employee.employee_id]);
        await Promise.all(restoredDocs.rows.map(doc => syncRow('employee_documents', doc, 'document_id')));

        // 4️⃣ Restore attendance
        const restoredAttendance = await client.query(`
            INSERT INTO employee_attendance
            (attendance_id, employee_id, attend_date, clock_in, clock_out, total_hours, status)
            SELECT attendance_id, employee_id, attend_date, clock_in, clock_out, total_hours, status
            FROM employee_attendance_archive
            WHERE employee_id = $1
            RETURNING *
        `, [employee.employee_id]);
        await Promise.all(restoredAttendance.rows.map(att => syncRow('employee_attendance', att, 'attendance_id')));

        // 5️⃣ Restore incident reports
        const restoredIncidents = await client.query(`
            INSERT INTO incident_reports
            (incident_id, employee_id, incident_type, incident_date, witness, reported_by, description, status)
            SELECT incident_id, employee_id, incident_type, incident_date, witness, reported_by, description, status
            FROM incident_reports_archive
            WHERE employee_id = $1
            RETURNING *
        `, [employee.employee_id]);
        await Promise.all(restoredIncidents.rows.map(ir => syncRow('incident_reports', ir, 'incident_id')));

        // 6️⃣ Restore user accounts
        const restoredUsers = await client.query(`
            INSERT INTO users
            (account_id, employee_id, fullname, role, email, password, must_change_password)
            SELECT account_id, employee_id, fullname, role, email, password, must_change_password
            FROM users_archive
            WHERE employee_id = $1
            RETURNING *
        `, [employee.employee_id]);
        await Promise.all(restoredUsers.rows.map(user => syncRow('users', user, 'account_id')));
        
        // 7️⃣ Restore employee contracts if present
        const restoredContracts = await client.query(`
            INSERT INTO employee_contracts (employee_id, start_of_contract, end_of_contract, contract_type)
            SELECT employee_id, start_of_contract, end_of_contract, contract_type
            FROM employee_contracts_archive
            WHERE employee_id = $1
            RETURNING *
        `, [employee.employee_id]);

        for (const c of restoredContracts.rows) {
            try {
                await syncRow('employee_contracts', c, 'contract_id');
            } catch (err) {
                console.error(`Supabase sync failed for contract ${c.contract_id}:`, err);
            }
        }


        // Step 2: Insert new contract if data is provided
        if (employee.start_date && employee.contract_type) {
            const { rows: newContractRows } = await client.query(`
                INSERT INTO employee_contracts (employee_id, start_of_contract, end_of_contract, contract_type)
                VALUES ($1, $2, $3, $4)
                RETURNING *
            `, [employee.employee_id, employee.start_date, employee.end_date || null, employee.contract_type]);

            const newContract = newContractRows[0];
            try {
                await syncRow('employee_contracts', newContract, 'contract_id');
            } catch (err) {
                console.error(`Supabase sync failed for new contract ${newContract.contract_id}:`, err);
            }
        }

        // 8️⃣ Delete archives in parallel
        const archiveTables = [
            'employees_archive',
            'employee_dependents_archive',
            'employee_documents_archive',
            'employee_attendance_archive',
            'incident_reports_archive',
            'employee_contracts_archive',
            'users_archive'
        ];
        await Promise.all(
            archiveTables.map(t => client.query(`DELETE FROM ${t} WHERE employee_id = $1`, [employee.employee_id]))
        );

        await client.query('COMMIT');

        // 9️⃣ Send reactivation email after commit
        if (employee.email && employee.fullname) {
            await sendEmployeeActivatedEmail(employee.email, employee.fullname);
        }

        console.log(`✅ Employee ${employee.employee_id} restored successfully.`);
    } catch (err) {
        await client.query('ROLLBACK');
        console.error(`❌ Failed to restore employee ${employee.employee_id}:`, err.message);
    } finally {
        client.release();
    }
};

/** Schedule restoration */
export const scheduleEmployeeRestoration = async (pool, employee) => {
    const restorationTime = getRestorationTime(employee.start_date);
    if (!restorationTime) return;

    // Send pre-restoration email if in future
    if (restorationTime > DateTime.now().setZone('Asia/Manila') && employee.email && employee.fullname) {
        await sendRestorationScheduledEmail(employee.email, employee.fullname, restorationTime.toJSDate());
    }

    const now = DateTime.now().setZone('Asia/Manila');
    if (restorationTime <= now) {
        await restoreEmployeeNow(pool, employee);
    } else {
        schedule.scheduleJob(restorationTime.toJSDate(), async () => {
            await restoreEmployeeNow(pool, employee);
        });
        console.log(`⏰ Employee ${employee.employee_id} scheduled for restoration on ${restorationTime.toFormat('yyyy-MM-dd HH:mm')}`);
    }
};

/** Initialize restoration schedules at startup */
export const initEmployeeRestorationSchedules = async (pool) => {
    const client = await pool.connect();
    try {
        const { rows: futureEmployees } = await client.query(`
            SELECT e.employee_id, e.status, e.is_restored, e.effective_deletion_date, c.end_of_contract, 
                   e.email, e.fullname, e.start_date
            FROM employees e
            LEFT JOIN (
                SELECT DISTINCT ON (employee_id) employee_id, end_of_contract
                FROM employee_contracts
                ORDER BY employee_id, updated_at DESC
            ) c ON e.employee_id = c.employee_id
            WHERE (e.effective_deletion_date > CURRENT_DATE OR c.end_of_contract > CURRENT_DATE)
              AND e.status NOT IN ('Employed', 'Probationary')
              AND NOT COALESCE(e.is_restored, FALSE)
        `);

        await Promise.all(futureEmployees.map(emp => scheduleEmployeeRestoration(pool, emp)));

        console.log('✅ Employee restoration schedules initialized.');
    } finally {
        client.release();
    }
};
