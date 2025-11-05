import argon2 from 'argon2';
import { sendEmployeeEmail } from '../utils/sendEmail.js';
import { scheduleEmployeeDeletion } from '../utils/employeeDeletionScheduler.js';
import { calculateAge } from '../utils/calculateAge.js';
import { syncRow, deleteRow } from '../utils/syncToSupabase.js';
import { emitRequestUpdate, emitRequestDelete } from '../utils/socketHelper.js';
import { sendNotification, generateRequestNotificationMessage } from '../utils/notificationHelper.js';

import { getIo } from "../socket.js";

export function employeeController(pool) {

    const getAllEmployees = async (req, reply) => {
        try {
            const requiredDocuments = ['SSS ID', 'Resume/CV', 'Pag-Ibig', 'PhilHealth', 'Barangay Clearance'];

            const result = await pool.query(`
                SELECT e.*,
                    CASE
                        WHEN (
                            SELECT COUNT(*) 
                            FROM employee_documents d
                            WHERE d.employee_id = e.employee_id
                            AND d.document_type = ANY($1)
                            AND d.status = 'Approved'
                        ) = $2
                        THEN true
                        ELSE false
                    END AS documents_complete
                FROM employees e
                ORDER BY e.employee_id ASC;
            `, [requiredDocuments, requiredDocuments.length]);

            return { success: true, data: result.rows };
        } catch (err) {
            console.error("Database Error:", err.message);
            reply.status(500).send({ error: "Database query failed" });
        }
    };

    const addEmployee = async (req, reply) => {
        const {
            fullname, nickname, email, position, employment_type, status, gender,
            contact, marital_status, birthday, address, sss_number, pagibig, philhealth,
            emergency_name, relationship, emergency_address, emergency_contact,
            city, postal_code, gcash_no,
            start_of_contract, end_of_contract
        } = req.body;
        
        const trim = v => (typeof v === "string" ? v.trim() : v);
        const phone = v => trim(v)?.replace(/\s+/g, "") || null;

        const d = {
            fullname: trim(fullname),
            nickname: trim(nickname),
            email: trim(email),
            position: trim(position),
            employment_type: trim(employment_type),
            status: trim(status),
            gender: trim(gender),
            contact: phone(contact),
            marital_status: trim(marital_status),
            birthday: trim(birthday),
            address: trim(address),
            sss_number: trim(sss_number),
            pagibig: trim(pagibig),
            philhealth: trim(philhealth),
            emergency_name: trim(emergency_name),
            relationship: trim(relationship),
            emergency_address: trim(emergency_address),
            emergency_contact: phone(emergency_contact),
            city: trim(city),
            postal_code: trim(postal_code),
            gcash_no: phone(gcash_no),
            start_of_contract: trim(start_of_contract),
            end_of_contract: trim(end_of_contract)
        };

        if (!d.fullname || !d.email || !d.employment_type || !d.gender) {
            return reply.status(400).send({ error: "Required fields missing." });
        }

        const tempPassword = `${d.fullname.split(" ")[0]?.toUpperCase()}-${new Date(d.birthday).getFullYear()}`;
        const hashedPassword = await argon2.hash(tempPassword, {
            type: argon2.argon2id,
            timeCost: 1,
            memoryCost: 512,
            parallelism: 1,
        });

        const client = await pool.connect();

        try {
            await client.query("BEGIN");

            const check = await client.query(`
                SELECT 1 FROM employee_registry WHERE email = $1 OR fullname = $2
            `, [d.email, d.fullname]);

            if (check.rowCount > 0) {
                await client.query("ROLLBACK");
                return reply.status(400).send({ error: "Employee already exists." });
            }

            const registry = await client.query(`
                INSERT INTO employee_registry (email, fullname)
                VALUES ($1, $2)
                RETURNING id, email, fullname
            `, [d.email, d.fullname]);
            const registryRow = registry.rows[0];
            
            const empRes = await client.query(`
                INSERT INTO employees
                (registry_id, fullname, nickname, email, position, employment_type, status, gender, contact, marital_status, birthday, address, sss_number, pagibig, philhealth)
                VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
                RETURNING *
            `, [
                registryRow.id, d.fullname, d.nickname, d.email, d.position || '',
                d.employment_type, d.status, d.gender, d.contact,
                d.marital_status, d.birthday, d.address, d.sss_number,
                d.pagibig, d.philhealth
            ]);
            const employee = empRes.rows[0];

            const docTypes = ['SSS ID', 'Resume/CV', 'Pag-Ibig', 'PhilHealth', 'Barangay Clearance'];
            const docsToSync = [];
            for (const type of docTypes) {
                const res = await client.query(`
                    INSERT INTO employee_documents (employee_id, document_type, status, created_at, updated_at)
                    VALUES ($1, $2, 'Incomplete', NOW(), NOW())
                    RETURNING *
                `, [employee.employee_id, type]);
                docsToSync.push(res.rows[0]);
            }

            const empNotif = await client.query(`
                INSERT INTO employee_notifications(employee_id, count)
                VALUES ($1, 0)
                RETURNING *
            `, [employee.employee_id]);
            const notification = empNotif.rows[0];

            const userRes = await client.query(`
                INSERT INTO users (employee_id, email, fullname, role, password, must_change_password)
                VALUES ($1,$2,$3,$4,$5,true)
                RETURNING *
            `, [employee.employee_id, d.email, d.fullname, d.position, hashedPassword]);
            const user = userRes.rows[0];
            
            const startDate = d.start_of_contract || new Date().toISOString().split("T")[0];
            const contractRes = await client.query(`
                INSERT INTO employee_contracts (employee_id, start_of_contract, end_of_contract, contract_type)
                VALUES ($1, $2, $3, $4)
                RETURNING *
            `, [employee.employee_id, startDate, d.end_of_contract || null, d.employment_type || null]);
            const contractRow = contractRes.rows[0];
            
            await client.query("COMMIT");

            // Send response to UI first
            reply.send({ success: true, employee });

            // Background sync with error handling
            setImmediate(async () => {
                try {
                    await syncRow('employee_registry', registryRow, 'id');
                } catch (err) {
                    console.error("❌ Supabase sync error (employee_registry):", err.message);
                }

                try {
                    await syncRow('employees', employee, 'employee_id');
                } catch (err) {
                    console.error("❌ Supabase sync error (employees):", err.message);
                }

                for (const doc of docsToSync) {
                    try {
                        await syncRow('employee_documents', doc, 'id');
                    } catch (err) {
                        console.error("❌ Supabase sync error (employee_documents):", err.message);
                    }
                }

                try {
                    await syncRow('employee_notifications', notification, 'employee_id');
                } catch (err) {
                    console.error("❌ Supabase sync error (employee_notifications):", err.message);
                }

                try {
                    await syncRow('users', user, 'account_id');
                } catch (err) {
                    console.error("❌ Supabase sync error (users):", err.message);
                }

                try {
                    await syncRow('employee_contracts', contractRow, 'contract_id');
                } catch (err) {
                    console.error("❌ Supabase sync error (employee_contracts):", err.message);
                }

                sendEmployeeEmail(d.email, d.fullname, tempPassword).catch(() => {});
            });
        } catch (err) {
            await client.query("ROLLBACK");
            console.error(err);
            return reply.status(500).send({ error: "Failed to add employee" });
        } finally {
            client.release();
        }
    };

    const getSingleEmployee = async (req, reply) => {
        const { id } = req.params;
        try {
            const empRes = await pool.query('SELECT * FROM employees WHERE employee_id = $1', [id]);
            if (!empRes.rows.length) return reply.status(404).send({ error: "Employee not found" });
            const employee = empRes.rows[0];

            const depRes = await pool.query('SELECT * FROM employee_dependents WHERE employee_id = $1', [id]);
            const dependent = depRes.rows[0] || {};

            return {
                ...employee,
                emergency_name: dependent.fullname || null,
                relationship: dependent.relationship || null,
                emergency_address: dependent.address || null,
                emergency_contact: dependent.contact || null,
                city: dependent.city || null,
                postal_code: dependent.postalcode || null,
                gcash_no: dependent.gcash_number || null
            };
        } catch (err) {
            console.error("Database Error:", err.message);
            reply.status(500).send({ error: "Database query failed" });
        }
    };

    const getSingleEmployeeContract = async (req, reply) => {
        const { id } = req.params;
        try {
            const conRes = await pool.query(`
                SELECT 
                    TO_CHAR(start_of_contract, 'FMMonth DD, YYYY') as start_of_contract,
                    TO_CHAR(end_of_contract, 'FMMonth DD, YYYY') as end_of_contract
                FROM employee_contracts WHERE employee_id = $1
            `, [id]);
            return { success: true, data: conRes.rows || [] };
        } catch (err) {
            console.error("Database error: ", err.message);
            return reply.status(500).send({ message: "Fetching employee contract failed." });
        }
    };

    const updateEmployee = async (req, reply) => {
        const { id } = req.params;
        const client = await pool.connect();
        const {
            fullname, nickname, email, position, employment_type, status, gender,
            contact, marital_status, birthday, address, sss_number, pagibig, philhealth,
            emergency_name, relationship, emergency_address, emergency_contact,
            city, postal_code, gcash_no, contract_date, contract_type
        } = req.body;

        try {
            await client.query('BEGIN');

            const conflictRows = [];

            const empCheck = await client.query(`
                SELECT email, fullname
                FROM employees
                WHERE (email = $1 OR fullname = $2) AND employee_id != $3
            `, [email, fullname, id]);
            conflictRows.push(...empCheck.rows);

            const archiveCheck = await client.query(`
                SELECT email, fullname
                FROM employees_archive
                WHERE email = $1 OR fullname = $2
            `, [email, fullname]);
            conflictRows.push(...archiveCheck.rows);

            const errors = [];
            conflictRows.forEach(r => {
                if (r.email === email && !errors.some(e => e.field === "email")) {
                    errors.push({ field: "email", error: "Email already exists." });
                }
                if (r.fullname === fullname && !errors.some(e => e.field === "fullname")) {
                    errors.push({ field: "fullname", error: "Full name already exists." });
                }
            });

            if (errors.length > 0) {
                await client.query('ROLLBACK');
                return reply.status(400).send({ errors });
            }

            const empRes = await client.query('SELECT * FROM employees WHERE employee_id=$1', [id]);
            if (!empRes.rows.length) throw new Error("Employee not found");
            const oldEmployee = empRes.rows[0];

            const updateRes = await client.query(`
                UPDATE employees
                SET fullname=$1, nickname=$2, email=$3, position=$4, employment_type=$5,
                    status=$6, gender=$7, contact=$8, marital_status=$9, birthday=$10,
                    address=$11, sss_number=$12, pagibig=$13, philhealth=$14
                WHERE employee_id=$15
                RETURNING *;
            `, [fullname, nickname, email, position, employment_type, status, gender, contact, marital_status, birthday, address, sss_number, pagibig, philhealth, id]);

            const updatedEmployee = updateRes.rows[0];

            const depUpdateRes = await client.query(`
                UPDATE employee_dependents
                SET fullname=$1, relationship=$2, address=$3, contact=$4,
                    city=$5, postalcode=$6, gcash_number=$7
                WHERE employee_id=$8
                RETURNING *;
            `, [emergency_name, relationship, emergency_address, emergency_contact, city, postal_code, gcash_no, id]);
            const updatedDependent = depUpdateRes.rows[0];

            let newContract = null;
            if (contract_date && contract_type) {
                const contractRes = await client.query(`
                    INSERT INTO employee_contracts(employee_id, end_of_contract, contract_type)
                    VALUES ($1, $2, $3)
                    RETURNING *;
                `, [id, contract_date, contract_type]);
                newContract = contractRes.rows[0];
            }

            const dependentsRes = await client.query(
                `SELECT fullname AS emergency_name, relationship, address AS emergency_address,
                        contact AS emergency_contact, city, postalcode AS postal_code, gcash_number AS gcash_no
                FROM employee_dependents
                WHERE employee_id = $1`,
                [id]
            );

            const updatedEmployeeWithDependents = {
                ...updatedEmployee,
                ...dependentsRes.rows[0],
            };

            await client.query('COMMIT');

            // Send response to UI first
            reply.send({ success: true, employee: updatedEmployeeWithDependents });

            // Background sync with error handling
            setImmediate(async () => {
                try {
                    await syncRow('employees', updatedEmployee, 'employee_id');
                } catch (err) {
                    console.error("❌ Supabase sync error (employees):", err.message);
                }

                if (updatedDependent) {
                    try {
                        await syncRow('employee_dependents', updatedDependent, 'id');
                    } catch (err) {
                        console.error("❌ Supabase sync error (employee_dependents):", err.message);
                    }
                }

                if (newContract) {
                    try {
                        await syncRow('employee_contracts', newContract, 'contract_id');
                    } catch (err) {
                        console.error("❌ Supabase sync error (employee_contracts):", err.message);
                    }
                }

                if (oldEmployee.email !== email) {
                    const firstName = fullname.split(" ")[0]?.toUpperCase();
                    const birthYear = new Date(birthday).getFullYear();
                    const tempPassword = `${firstName}-${birthYear}`;
                    sendEmployeeEmail(email, fullname, updatedEmployee.employee_id, tempPassword)
                        .catch(err => console.warn("Email not sent:", err.message));
                }
            });

        } catch (err) {
            await client.query('ROLLBACK');
            if (err.code === "23505") {
                if (err.constraint === "unique_fullname") {
                    return reply.status(400).send({
                        field: "fullname",
                        error: "Full name already exists."
                    });
                }
                if (err.constraint === "unique_email") {
                    return reply.status(400).send({
                        field: "email",
                        error: "Email address already exists."
                    });
                }
            }
            console.error("Update Error:", err.message);
            reply.status(500).send({ error: "Failed to update employee" });
        } finally {
            client.release();
        }
    };

    const deleteEmployee = async (req, reply) => {
        const { id } = req.params;
        const { status, deletion_date } = req.body;

        if (!status) return reply.status(400).send({ error: "Missing status" });
        if (!deletion_date || isNaN(new Date(deletion_date))) {
            return reply.status(400).send({ error: "Invalid deletion date" });
        }

        const client = await pool.connect();
        try {
            await client.query("BEGIN");

            const res = await client.query("SELECT * FROM employees WHERE employee_id = $1", [id]);
            if (!res.rowCount) {
                await client.query("ROLLBACK");
                return reply.status(404).send({ error: "Employee not found" });
            }

            const employee = res.rows[0];

            const updateRes = await client.query(
                `UPDATE employees
                SET effective_deletion_date = $1, deletion_status = $2
                WHERE employee_id = $3
                RETURNING *`,
                [deletion_date, status, id]
            );
            const updatedEmployee = updateRes.rows[0];

            await client.query("COMMIT");

            // Send response to UI first
            reply.send({
                message: `Employee ${id} scheduled for deletion on ${deletion_date}`,
            });

            // Background operations
            setImmediate(async () => {
                try {
                    await syncRow('employees', updatedEmployee, 'employee_id');
                } catch (err) {
                    console.error("❌ Supabase sync error (employees):", err.message);
                }

                scheduleEmployeeDeletion(pool, {
                    ...employee,
                    effective_deletion_date: deletion_date,
                    status,
                });
            });

        } catch (err) {
            await client.query("ROLLBACK");
            console.error("❌ Delete employee failed:", err.message);
            reply.status(500).send({ error: "Failed to schedule employee deletion" });
        } finally {
            client.release();
        }
    };

    const getAllEmployeeRequests = async (req, reply) => {
        try {
            const { rows: leaveRows } = await pool.query(`
                SELECT 
                    r.request_id,
                    r.employee_id,
                    e.fullname AS employee_name,
                    'leave' AS request_type,
                    r.type,
                    r.days,
                    TO_CHAR(r.start_date, 'MM/DD/YYYY') AS start_date,
                    TO_CHAR(r.end_date, 'MM/DD/YYYY') AS end_date,
                    NULL AS date,
                    0 AS hours,
                    r.reason,
                    r.attach_link AS link,
                    r.status,
                    TO_CHAR(r.created_at, 'MM/DD/YYYY') AS requested_at
                FROM leave_requests r
                JOIN employees e ON r.employee_id = e.employee_id
            `);

            const { rows: overtimeRows } = await pool.query(`
                SELECT 
                    r.request_id,
                    r.employee_id,
                    e.fullname AS employee_name,
                    'overtime' AS request_type,
                    r.type,
                    0 AS days,
                    NULL AS start_date,
                    NULL AS end_date,
                    TO_CHAR(r.date, 'MM/DD/YYYY') AS date,
                    r.hours,
                    r.reason,
                    r.attach_link AS link,
                    r.status,
                    TO_CHAR(r.created_at, 'MM/DD/YYYY') AS requested_at
                FROM overtime_requests r
                JOIN employees e ON r.employee_id = e.employee_id
            `);

            const { rows: offsetRows } = await pool.query(`
                SELECT 
                    r.request_id,
                    r.employee_id,
                    e.fullname AS employee_name,
                    'off-set' AS request_type,
                    r.type,
                    0 AS days,
                    NULL AS start_date,
                    NULL AS end_date,
                    TO_CHAR(r.date, 'MM/DD/YYYY') AS date,
                    r.hours,
                    r.reason,
                    r.attach_link AS link,
                    r.status,
                    TO_CHAR(r.created_at, 'MM/DD/YYYY') AS requested_at
                FROM offset_requests r
                JOIN employees e ON r.employee_id = e.employee_id
            `);

            const allRequests = [...leaveRows, ...overtimeRows, ...offsetRows].sort((a, b) =>
                new Date(b.requested_at) - new Date(a.requested_at)
            );

            return reply.send({ success: true, data: allRequests });

        } catch (err) {
            console.error("Error fetching all employee requests:", err);
            return reply.code(500).send({ success: false, message: "Failed to fetch employee requests" });
        }
    };

    const updateEmployeeRequest = async (req, reply) => {
        const io = getIo();
        const { type, requestId } = req.params;
        const { status, remarks, days, hours } = req.body;

        const table = type === "leave" ? "leave_requests" : type === "overtime" ? "overtime_requests" : "offset_requests";
        const client = await pool.connect();

        try {
            await client.query("BEGIN");

            const resQuery = await client.query(`SELECT * FROM ${table} WHERE request_id = $1`, [requestId]);
            if (!resQuery.rows.length) {
                await client.query("ROLLBACK");
                return reply.status(404).send({ success: false, message: "Request not found" });
            }

            const reqData = resQuery.rows[0];

            const params = [status || reqData.status, remarks || reqData.remarks];
            let updateQuery = `UPDATE ${table} SET status = $1, remarks = $2`;

            if (type === "leave") {
                updateQuery += `, days = COALESCE($3, days)`;
                params.push(days);
            } else {
                updateQuery += `, hours = COALESCE($3, hours)`;
                params.push(hours);
            }

            updateQuery += ` WHERE request_id = $4 RETURNING *`;
            params.push(requestId);

            const updated = (await client.query(updateQuery, params)).rows[0];
            
            const employeeRes = await client.query(
                `SELECT fullname FROM employees WHERE employee_id = $1`, 
                [updated.employee_id]
            );
            const employeeName = employeeRes.rows[0]?.fullname || "Unknown";

            const notificationMessage = generateRequestNotificationMessage(type, updated.type, status, remarks);
            await sendNotification(pool, updated.employee_id, type, status, notificationMessage, client);

            await client.query("COMMIT");

            const payload = {
                ...updated,
                employee_name: employeeName,
                request_type: type,
                link: updated.attach_link
            };

            // Send response to UI first
            reply.send({ success: true, data: updated });

            // Background operations
            setImmediate(async () => {
                // Socket emit
                emitRequestUpdate(io, payload);

                // Sync to Supabase with error handling
                try {
                    await syncRow(table, updated, 'request_id');
                } catch (err) {
                    console.error(`❌ Supabase sync error (${table}):`, err.message);
                }
            });

        } catch (err) {
            await client.query("ROLLBACK");
            console.error("❌ Update request error:", err);
            return reply.status(500).send({ success: false, message: "Failed to update request" });
        } finally {
            client.release();
        }
    };

    return {
        getAllEmployees,
        addEmployee,
        getSingleEmployee,
        getSingleEmployeeContract,
        updateEmployee,
        deleteEmployee,
        getAllEmployeeRequests,
        updateEmployeeRequest
    };
}