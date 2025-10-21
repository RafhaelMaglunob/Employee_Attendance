import schedule from 'node-schedule';
import { DateTime } from "luxon";

/**
 * Safely create Luxon DateTime from deletionDate (Date or string)
 */
const getDeletionTime = (deletionDate) => {
    if (!deletionDate) return null;
    let dt;
    if (deletionDate instanceof Date) {
        dt = DateTime.fromJSDate(deletionDate, { zone: 'Asia/Manila' });
    } else if (typeof deletionDate === 'string') {
        // Parse as UTC if ends with Z, then convert to Manila
        if (deletionDate.endsWith('Z')) {
            dt = DateTime.fromISO(deletionDate, { zone: 'utc' }).setZone('Asia/Manila');
        } else {
            dt = DateTime.fromISO(deletionDate, { zone: 'Asia/Manila' });
        }
    } else {
        return null;
    }

    if (!dt.isValid) return null;

    // Always set the scheduled deletion to 10:00 AM (Manila)
    return dt.set({ hour: 10, minute: 0, second: 0, millisecond: 0 });
};

/**
 * Deletes an employee immediately and archives their data
 */
const deleteEmployeeNow = async (pool, employee) => {
    const deletionDate = employee.effective_deletion_date || employee.end_of_contract;
    const deletionTime = getDeletionTime(deletionDate);
    if (!deletionTime) {
        console.log(`❌ Invalid or missing deletion date for employee ${employee.employee_id}. Skipping.`);
        return;
    }

    const deletionJSDate = deletionTime.toJSDate();
    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        const statusToArchive = employee.effective_deletion_date
            ? employee.status
            : "End of Contract";

        // 1️⃣ Archive employee
        await client.query(`
            INSERT INTO employees_archive (
                employee_id, fullname, nickname, email, position, employment_type, status, gender, contact,
                birthday, marital_status, address, sss_number, pagibig, philhealth, current_status
            )
            SELECT 
                employee_id, fullname, nickname, email, position, employment_type, $2, gender, contact,
                birthday, marital_status, address, sss_number, pagibig, philhealth, $2
            FROM employees
            WHERE employee_id = $1
            ON CONFLICT (employee_id) DO NOTHING
        `, [employee.employee_id, statusToArchive]);

        // 2️⃣ Archive dependents
        await client.query(`
            INSERT INTO employee_dependents_archive (
                employee_id, fullname, relationship, address, contact, city, postalcode, gcash_number
            )
            SELECT employee_id, fullname, relationship, address, contact, city, postalcode, gcash_number
            FROM employee_dependents
            WHERE employee_id = $1
        `, [employee.employee_id]);

        // 3️⃣ Archive documents
        await client.query(`
            INSERT INTO employee_documents_archive (
                document_id, employee_id, sss_id, resume_cv, pagibig, philhealth, barangay_clearance
            )
            SELECT document_id, employee_id, sss_id, resume_cv, pagibig, philhealth, barangay_clearance
            FROM employee_documents
            WHERE employee_id = $1
        `, [employee.employee_id]);

        // 4️⃣ Archive contracts
        const { rows: contracts } = await client.query(
            'SELECT * FROM employee_contracts WHERE employee_id = $1 ORDER BY updated_at DESC LIMIT 1',
            [employee.employee_id]
        );

        if (contracts.length > 0) {
            await client.query(`
                INSERT INTO employee_contracts_archive (
                    contract_id, employee_id, start_of_contract, end_of_contract, contract_type
                )
                SELECT contract_id, employee_id, start_of_contract, end_of_contract, contract_type
                FROM employee_contracts
                WHERE employee_id = $1
            `, [employee.employee_id]);
        }

        // 5️⃣ Archive employee account
        await client.query(`
            INSERT INTO employee_account_archive (
                account_id, employee_id, email, password, must_change_password
            )
            SELECT account_id, employee_id, email, password, must_change_password
            FROM employee_account
            WHERE employee_id = $1
        `, [employee.employee_id]);

        // 6️⃣ Delete from main tables
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

        for (const t of tablesToDelete) {
            await client.query(`DELETE FROM ${t} WHERE employee_id = $1`, [employee.employee_id]);
        }

        await client.query('COMMIT');
        console.log(`✅ Archived and deleted employee: ${employee.employee_id}`);
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
        console.log(`⏰ Deletion time already passed. Deleting employee ${employee.employee_id} now.`);
        await deleteEmployeeNow(pool, employee);
    } else {
        const formattedDate = deletionTime.toFormat('MMMM dd, yyyy');
        console.log(`⏰ Scheduled deletion for employee ${employee.employee_id} at: ${formattedDate}`);
        schedule.scheduleJob(jsDate, async () => {
            await deleteEmployeeNow(pool, employee);
        });
    }
};

/**
 * Recurring timer — checks every 1 minute for employees due for deletion
 */
export const startEmployeeDeletionTimer = (pool) => {
    schedule.scheduleJob('*/1 * * * *', async () => {
        const client = await pool.connect();
        try {
            const { rows: employees } = await client.query(`
                SELECT e.employee_id, e.status, e.effective_deletion_date, c.end_of_contract
                FROM employees e
                LEFT JOIN (
                    SELECT DISTINCT ON (employee_id)
                        employee_id, end_of_contract
                    FROM employee_contracts
                    ORDER BY employee_id, updated_at DESC
                ) c ON e.employee_id = c.employee_id
                WHERE (e.effective_deletion_date <= CURRENT_DATE)
                OR (c.end_of_contract <= CURRENT_DATE)
            `);

            for (const emp of employees) {
                await deleteEmployeeNow(pool, emp);
            }
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
        // 1️⃣ Delete employees with past-due end dates
        const { rows: pastEmployees } = await client.query(`
            SELECT e.employee_id, e.status, e.effective_deletion_date, c.end_of_contract
            FROM employees e
            LEFT JOIN (
                SELECT DISTINCT ON (employee_id)
                    employee_id, end_of_contract
                FROM employee_contracts
                ORDER BY employee_id, updated_at DESC
            ) c ON e.employee_id = c.employee_id
            WHERE (e.effective_deletion_date <= CURRENT_DATE)
            OR (c.end_of_contract <= CURRENT_DATE)
        `);

        for (const emp of pastEmployees) {
            await deleteEmployeeNow(pool, emp);
        }

        // 2️⃣ Schedule upcoming deletions
        const { rows: futureEmployees } = await client.query(`
            SELECT e.employee_id, e.status, e.effective_deletion_date, c.end_of_contract
            FROM employees e
            LEFT JOIN (
                SELECT DISTINCT ON (employee_id)
                    employee_id, end_of_contract
                FROM employee_contracts
                ORDER BY employee_id, updated_at DESC
            ) c ON e.employee_id = c.employee_id
            WHERE (c.end_of_contract > CURRENT_DATE)
            OR (e.effective_deletion_date > CURRENT_DATE)
        `);

        for (const emp of futureEmployees) {
            scheduleEmployeeDeletion(pool, emp);
        }

        console.log('✅ Employee deletion schedules initialized.');
    } finally {
        client.release();
    }

    // 3️⃣ Start recurring 1-minute timer
    startEmployeeDeletionTimer(pool);
};
