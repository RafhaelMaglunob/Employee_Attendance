// employeeDeletionScheduler.js
import schedule from 'node-schedule';

/**
 * Deletes an employee immediately and archives their data
 */
const deleteEmployeeNow = async (pool, employee) => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');

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
        `, [employee.employee_id, employee.status]);

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
            'SELECT * FROM employee_contracts WHERE employee_id = $1',
            [employee.employee_id]
        );
        console.log('Contracts to archive:', contracts);

        if (contracts.length > 0) {
            await client.query(`
                INSERT INTO employee_contracts_archive (
                contract_id, employee_id, start_of_contract, end_of_contract, contract_type
                )
                SELECT contract_id, employee_id, start_of_contract, end_of_contract, contract_type
                FROM employee_contracts
                WHERE employee_id = $1
            `, [employee.employee_id]);
        } else {
            console.log('No contracts found for this employee.');
        }

        await client.query(`
            INSERT INTO employee_account_archive (
                account_id, employee_id, email, password, must_change_password
            )
            SELECT account_id, employee_id, email, password, must_change_password
            FROM employee_account
            WHERE employee_id = $1
        `, [employee.employee_id]);


        // 5️⃣ Delete all main tables including contracts
        const tablesToDelete = [
            'employee_documents', 
            'employee_dependents', 
            'employee_work_logs',
            'incident_reports', 
            'employee_account', 
            'employee_attendance', 
            'employee_contracts',  // now included!
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
 * Schedule deletion for a single employee at a specific time
 */
export const scheduleEmployeeDeletion = (pool, employee) => {
    const deletionDate = employee.effective_deletion_date || employee.end_of_contract;
    if (!deletionDate) return;

    const deletionTime = new Date(deletionDate);
    deletionTime.setHours(10, 0, 0, 0); // run at 10:00 AM

    if (deletionTime > new Date()) {
        console.log(`⏰ Scheduled deletion for employee ${employee.employee_id} at: ${deletionTime.toLocaleString()}`);
        schedule.scheduleJob(deletionTime, async () => {
            await deleteEmployeeNow(pool, employee);
        });
    }
};

/**
 * Recurring timer to catch any employees whose deletion date is today or past
 */
export const startEmployeeDeletionTimer = (pool) => {
    schedule.scheduleJob('*/1 * * * *', async () => { // every 1 minute
        const client = await pool.connect();
        try {
            const { rows: employees } = await client.query(`
                SELECT e.employee_id, e.status, e.effective_deletion_date, c.end_of_contract
                FROM employees e
                LEFT JOIN employee_contracts c ON e.employee_id = c.employee_id
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
        // 1️⃣ Delete any past-due employees immediately
        const { rows: pastEmployees } = await client.query(`
            SELECT e.employee_id, e.status, e.effective_deletion_date, c.end_of_contract
            FROM employees e
            LEFT JOIN employee_contracts c ON e.employee_id = c.employee_id
            WHERE (e.effective_deletion_date <= CURRENT_DATE)
               OR (c.end_of_contract <= CURRENT_DATE)
        `);

        for (const emp of pastEmployees) {
            await deleteEmployeeNow(pool, emp);
        }

        // 2️⃣ Schedule future deletions
        const { rows: futureEmployees } = await client.query(`
            SELECT e.employee_id, e.status, e.effective_deletion_date, c.end_of_contract
            FROM employees e
            LEFT JOIN employee_contracts c ON e.employee_id = c.employee_id
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

    // 3️⃣ Start the recurring timer
    startEmployeeDeletionTimer(pool);
};
