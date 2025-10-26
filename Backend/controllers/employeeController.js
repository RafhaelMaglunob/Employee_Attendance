import bcrypt from 'bcrypt';
import { sendEmployeeEmail } from '../utils/sendEmail.js';
import { scheduleEmployeeDeletion } from '../utils/employeeDeletionScheduler.js';
import { calculateAge } from '../utils/calculateAge.js';
import { syncRow, deleteRow } from '../utils/syncToSupabase.js';

export function employeeController(pool) {

    const getAllEmployees = async (req, reply) => {
        try {
            const result = await pool.query(`
                SELECT e.*,
                    CASE
                        WHEN d.sss_id IS NOT NULL
                            AND d.resume_cv IS NOT NULL
                            AND d.pagibig IS NOT NULL
                            AND d.philhealth IS NOT NULL
                            AND d.barangay_clearance IS NOT NULL
                        THEN true
                        ELSE false
                    END AS documents_complete
                FROM employees e
                LEFT JOIN employee_documents d
                    ON e.employee_id = d.employee_id
                ORDER BY e.employee_id ASC;
            `);
            return { success: true, data: result.rows };
        } catch (err) {
            console.error("Database Error:", err.message);
            reply.status(500).send({ error: "Database query failed" });
        }
    };

    const addEmployee = async (req, reply) => {
        const {
            fullname, nickname, email, position, employment_type, status, gender,
            contact, marital_status, birthday, address, sss_no, pagibig_no, philhealth_no,
            emergency_name, relationship, emergency_address, emergency_contact,
            city, postal_code, gcash_no,
            start_of_contract, end_of_contract
        } = req.body;

        // --- Sanitizers ---
        const sanitizePhone = val => typeof val === "string" ? val.replace(/\s+/g, "") : val;
        const safe = val => (typeof val === "string" ? val.trim() : val);

        const safeData = {
            fullname: safe(fullname),
            nickname: safe(nickname),
            email: safe(email),
            position: safe(position),
            employment_type: safe(employment_type),
            status: safe(status),
            gender: safe(gender),
            contact: sanitizePhone(contact),
            marital_status: safe(marital_status),
            birthday: safe(birthday),
            address: safe(address),
            sss_no: safe(sss_no),
            pagibig_no: safe(pagibig_no),
            philhealth_no: safe(philhealth_no),
            emergency_name: safe(emergency_name),
            relationship: safe(relationship),
            emergency_address: safe(emergency_address),
            emergency_contact: sanitizePhone(emergency_contact),
            city: safe(city),
            postal_code: safe(postal_code),
            gcash_no: sanitizePhone(gcash_no),
            start_of_contract: safe(start_of_contract),
            end_of_contract: safe(end_of_contract)
        };

        // --- Validation ---
        const errors = [];
        const phoneRegex = /^63\d{10}$/;
        const postalRegex = /^\d{4,5}$/;
        const textRegex = /^[A-Za-z\s'.-]+$/;
        const emailRegex = /^[a-zA-Z0-9._%+-]+@(gmail\.com|yahoo\.com|outlook\.com|hotmail\.com|icloud\.com|edu\.ph|company\.ph)$/i;

        if (!safeData.fullname || !textRegex.test(safeData.fullname)) errors.push("Full name is required and must contain only letters.");
        if (!safeData.email) errors.push("Email is required.");
        else if (!emailRegex.test(safeData.email)) errors.push("Email must be valid and from allowed domains.");
        if (!safeData.employment_type) errors.push("Employment type is required.");
        if (!safeData.status) errors.push("Status is required.");
        if (!safeData.gender) errors.push("Gender is required.");
        if (!safeData.birthday) errors.push("Birthday is required.");

        const birthdate = new Date(safeData.birthday);
        const today = new Date();
        if (birthdate.toString() === "Invalid Date") errors.push("Invalid birthday format.");
        else if (birthdate > today) errors.push("Birthday cannot be in the future.");

        const empAge = calculateAge(safeData.birthday);
        if(empAge < 18) errors.push("Employee must be at least 18 years old.");

        if (safeData.employment_type?.toLowerCase() === "full-time") {
            if (!safeData.sss_no) errors.push("SSS No. is required for Full-Time employees.");
            if (!safeData.pagibig_no) errors.push("PAG-IBIG No. is required for Full-Time employees.");
            if (!safeData.philhealth_no) errors.push("PHILHEALTH No. is required for Full-Time employees.");
        }

        if (safeData.employment_type?.toLowerCase() === "part-time") {
            if (!safeData.start_of_contract) errors.push("Start of contract is required for Part-Time employees.");
            if (!safeData.end_of_contract) errors.push("End of contract is required for Part-Time employees.");
            if (safeData.start_of_contract && safeData.end_of_contract &&
                new Date(safeData.end_of_contract) < new Date(safeData.start_of_contract)) {
                errors.push("End of contract cannot be before start of contract.");
            }
        }

        if (!safeData.contact || !phoneRegex.test(safeData.contact)) errors.push("Invalid contact number.");
        if (!safeData.emergency_contact || !phoneRegex.test(safeData.emergency_contact)) errors.push("Invalid emergency contact number.");
        if (safeData.gcash_no && !phoneRegex.test(safeData.gcash_no)) errors.push("GCash number must start with +63 and be 12 digits.");
        if (safeData.postal_code && !postalRegex.test(safeData.postal_code)) errors.push("Postal code must be 4–5 digits only.");
        if (safeData.city && !textRegex.test(safeData.city)) errors.push("City must contain only letters.");
        if (safeData.relationship && !textRegex.test(safeData.relationship)) errors.push("Relationship must contain only letters.");

        if (errors.length > 0) return reply.status(400).send({ errors });

        // --- Password Setup ---
        const firstName = safeData.fullname.split(" ")[0]?.toUpperCase();
        const birthYear = new Date(safeData.birthday).getFullYear();
        const tempPassword = `${firstName}-${birthYear}`;
        const hashedPassword = await bcrypt.hash(tempPassword, 10);

        const client = await pool.connect();

        try {
            await client.query("BEGIN");

            // --- Conflict Check ---
            const conflictCheck = await client.query(`
                SELECT email, fullname
                FROM employee_registry
                WHERE email = $1 OR fullname = $2
            `, [safeData.email, safeData.fullname]);

            const conflicts = [];
            if (conflictCheck.rows.some(r => r.email === safeData.email)) conflicts.push({ field: "email", error: "Email address already exists." });
            if (conflictCheck.rows.some(r => r.fullname === safeData.fullname)) conflicts.push({ field: "fullname", error: "Full name already exists." });
            if (conflicts.length > 0) {
                await client.query("ROLLBACK");
                return reply.status(400).send({ errors: conflicts });
            }

            // --- Insert Registry ---
            const registry = await client.query(`
                INSERT INTO employee_registry (email, fullname)
                VALUES ($1, $2)
                RETURNING *
            `, [safeData.email, safeData.fullname]);
            const registryRow = registry.rows[0];

            // --- Insert Employee ---
            const empRes = await client.query(`
                INSERT INTO employees
                (registry_id, fullname, nickname, email, position, employment_type, status, gender, contact, marital_status, birthday, address, sss_number, pagibig, philhealth)
                VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
                RETURNING *
            `, [
                registryRow.id, safeData.fullname, safeData.nickname, safeData.email, safeData.position || '',
                safeData.employment_type, safeData.status, safeData.gender, safeData.contact,
                safeData.marital_status, safeData.birthday, safeData.address, safeData.sss_no,
                safeData.pagibig_no, safeData.philhealth_no
            ]);
            const employee = empRes.rows[0];

            // --- Optional Inserts ---
            let contract = null, dependent = null, account = null;

            if (safeData.employment_type?.toLowerCase() === "part-time") {
                const empContract = await client.query(`
                    INSERT INTO employee_contracts
                    (employee_id, start_of_contract, end_of_contract, contract_type)
                    VALUES ($1,$2,$3,$4)
                    RETURNING *
                `, [employee.employee_id, safeData.start_of_contract, safeData.end_of_contract, "Part-Time"]);
                contract = empContract.rows[0];
            } else if (safeData.employment_type?.toLowerCase() === "full-time") {
                const startDate = safeData.start_of_contract || new Date(); // default to today

                const empContract = await client.query(`
                    INSERT INTO employee_contracts
                    (employee_id, start_of_contract, end_of_contract, contract_type)
                    VALUES ($1, $2, NULL, $3)
                    RETURNING *
                `, [employee.employee_id, startDate, "Full-Time"]);

                contract = empContract.rows[0];
            }



            const empDep = await client.query(`
                INSERT INTO employee_dependents
                (employee_id, fullname, relationship, address, contact, city, postalcode, gcash_number)
                VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
                RETURNING *
            `, [
                employee.employee_id, safeData.emergency_name, safeData.relationship,
                safeData.emergency_address, safeData.emergency_contact,
                safeData.city, safeData.postal_code, safeData.gcash_no
            ]);
            dependent = empDep.rows[0];

            const empAcc = await client.query(`
                INSERT INTO users
                (employee_id, email, fullname, role, password, must_change_password)
                VALUES ($1,$2,$3,$4,$5,true)
                RETURNING *
            `, [employee.employee_id, safeData.email, safeData.fullname, safeData.position, hashedPassword]);
            account = empAcc.rows[0];

            await client.query("COMMIT");

            try {
                // 1️⃣ Sync registry first
                await syncRow(
                    'employee_registry',
                    { id: registryRow.id, email: registryRow.email, fullname: registryRow.fullname },
                    'id'
                );

                // 2️⃣ Sync employee
                await syncRow(
                    'employees',
                    {
                        employee_id: employee.employee_id,
                        registry_id: employee.registry_id,
                        fullname: employee.fullname,
                        nickname: employee.nickname,
                        email: employee.email,
                        position: employee.position,
                        employment_type: employee.employment_type,
                        status: employee.status,
                        gender: employee.gender,
                        contact: employee.contact,
                        marital_status: employee.marital_status,
                        birthday: employee.birthday,
                        address: employee.address,
                        sss_number: employee.sss_number,
                        pagibig: employee.pagibig,
                        philhealth: employee.philhealth
                    },
                    'employee_id'
                );

                // 3️⃣ Sync contracts & dependents concurrently (both depend on employee)
                await Promise.all([
                    contract ? syncRow('employee_contracts', contract, 'contract_id') : Promise.resolve(),
                    dependent ? syncRow('employee_dependents', dependent) : Promise.resolve()
                ]);

                // 4️⃣ Sync users (depends on employee)
                await syncRow('users', account, 'account_id');

            } catch (err) {
                console.warn("Supabase sync error:", err.message);
            }

            // --- Fire-and-forget email ---
            sendEmployeeEmail(safeData.email, safeData.fullname, tempPassword)
                .catch(err => console.warn("Email not sent:", err.message));

            return reply.send({ success: true, employee });

        } catch (err) {
            await client.query("ROLLBACK");
            console.error("Insert Error:", err.message);
            if (err.code === "23505") {
                if (err.constraint === "unique_fullname") return reply.status(400).send({ field: "fullname", error: "Full name already exists." });
                if (err.constraint === "unique_email") return reply.status(400).send({ field: "email", error: "Email address already exists." });
            }
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
            contact, marital_status, birthday, address, sss_no, pagibig_no, philhealth_no,
            emergency_name, relationship, emergency_address, emergency_contact,
            city, postal_code, gcash_no, contract_date, contract_type
        } = req.body;

        try {
            await client.query('BEGIN');

            // Multi-field conflict check across employees and employees_archive
            const conflictRows = [];

            // Check employees table
            const empCheck = await client.query(`
                SELECT email, fullname
                FROM employees
                WHERE (email = $1 OR fullname = $2) AND employee_id != $3
            `, [email, fullname, id]);
            conflictRows.push(...empCheck.rows);

            // Check employees_archive table
            const archiveCheck = await client.query(`
                SELECT email, fullname
                FROM employees_archive
                WHERE email = $1 OR fullname = $2
            `, [email, fullname]);
            conflictRows.push(...archiveCheck.rows);

            // Collect errors
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

            // Fetch old employee
            const empRes = await client.query('SELECT * FROM employees WHERE employee_id=$1', [id]);
            if (!empRes.rows.length) throw new Error("Employee not found");
            const oldEmployee = empRes.rows[0];

            // Update employees
            const updateRes = await client.query(`
                UPDATE employees
                SET fullname=$1, nickname=$2, email=$3, position=$4, employment_type=$5,
                    status=$6, gender=$7, contact=$8, marital_status=$9, birthday=$10,
                    address=$11, sss_number=$12, pagibig=$13, philhealth=$14
                WHERE employee_id=$15
                RETURNING *;
            `, [fullname, nickname, email, position, employment_type, status, gender, contact, marital_status, birthday, address, sss_no, pagibig_no, philhealth_no, id]);

            const updatedEmployee = updateRes.rows[0];

            // Update dependents
            await client.query(`
                UPDATE employee_dependents
                SET fullname=$1, relationship=$2, address=$3, contact=$4,
                    city=$5, postalcode=$6, gcash_number=$7
                WHERE employee_id=$8;
            `, [emergency_name, relationship, emergency_address, emergency_contact, city, postal_code, gcash_no, id]);

            // Insert contract if provided
            if (contract_date && contract_type){
                await client.query(`
                    INSERT INTO employee_contracts(employee_id, end_of_contract, contract_type)
                    VALUES ($1, $2, $3);
                `, [id, contract_date, contract_type]);
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
                ...dependentsRes.rows[0], // assuming only 1 dependent
            };

            await client.query('COMMIT');

            // Send email if changed
            if (oldEmployee.email !== email) {
                const firstName = fullname.split(" ")[0]?.toUpperCase();
                const birthYear = new Date(birthday).getFullYear();
                const tempPassword = `${firstName}-${birthYear}`;
                sendEmployeeEmail(email, fullname, updatedEmployee.employee_id, tempPassword)
                    .catch(err => console.warn("Email not sent:", err.message));
            }

            reply.send({ success: true, employee: updatedEmployeeWithDependents });

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

            await client.query(
                `
                UPDATE employees
                SET effective_deletion_date = $1, deletion_status = $2
                WHERE employee_id = $3
                `,
                [deletion_date, status, id]
            );

            await client.query("COMMIT");

            scheduleEmployeeDeletion(pool, {
                ...employee,
                effective_deletion_date: deletion_date,
                status,
            });

            reply.send({
                message: `Employee ${id} scheduled for deletion on ${deletion_date}`,
            });
        } catch (err) {
            await client.query("ROLLBACK");
            console.error("❌ Delete employee failed:", err.message);
            reply.status(500).send({ error: "Failed to schedule employee deletion" });
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
        deleteEmployee
    };
}
