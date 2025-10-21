import bcrypt from 'bcrypt';
import { sendEmployeeEmail } from '../utils/sendEmail.js';
import { scheduleEmployeeDeletion } from '../utils/employeeDeletionScheduler.js';
import { calculateAge } from '../utils/calculateAge.js';

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

        const errors = [];
        const phoneRegex = /^09\d{9}$/;
        const postalRegex = /^\d{4,5}$/;
        const textRegex = /^[A-Za-z\s'.-]+$/;   
        const emailRegex = /^[a-zA-Z0-9._%+-]+@(gmail\.com|yahoo\.com|outlook\.com|hotmail\.com|icloud\.com|edu\.ph|company\.ph)$/i;

        const safe = (val) => (typeof val === "string" ? val.trim() : val);

        const safeFullname = safe(fullname);
        const safeNickname = safe(nickname);
        const safeEmail = safe(email);
        const safePosition = safe(position);
        const safeEmploymentType = safe(employment_type);
        const safeStatus = safe(status);
        const safeGender = safe(gender);
        const safeContact = safe(contact);
        const safeMarital = safe(marital_status);
        const safeBirthday = safe(birthday);
        const safeAddress = safe(address);
        const safeSSS = safe(sss_no);
        const safePagibig = safe(pagibig_no);
        const safePhilhealth = safe(philhealth_no);
        const safeEmergencyName = safe(emergency_name);
        const safeRelationship = safe(relationship);
        const safeEmergencyAddress = safe(emergency_address);
        const safeEmergencyContact = safe(emergency_contact);
        const safeCity = safe(city);
        const safePostal = safe(postal_code);
        const safeGcash = safe(gcash_no);
        const safeStart = safe(start_of_contract);
        const safeEnd = safe(end_of_contract);

        // === VALIDATION ===
        if (!safeFullname || !textRegex.test(safeFullname)) errors.push("Full name is required and must contain only letters.");
        if (!safeEmail) errors.push("Email is required.");
        else if (!emailRegex.test(safeEmail)) errors.push("Email must be valid and from allowed domains.");
        if (!safeEmploymentType) errors.push("Employment type is required.");
        if (!safeStatus) errors.push("Status is required.");
        if (!safeGender) errors.push("Gender is required.");
        if (!safeBirthday) errors.push("Birthday is required.");

        const birthdate = new Date(safeBirthday);
        const today = new Date();
        if (birthdate.toString() === "Invalid Date") errors.push("Invalid birthday format.");
        else if (birthdate > today) errors.push("Birthday cannot be in the future.");

        const empAge = calculateAge(birthday);
        if(empAge < 15) errors.push("Employee must be at least 18 years old.");

        if (safeEmploymentType?.toLowerCase() === "full-time") {
            if (!safeSSS) errors.push("SSS No. is required for Full-Time employees.");
            if (!safePagibig) errors.push("PAG-IBIG No. is required for Full-Time employees.");
            if (!safePhilhealth) errors.push("PHILHEALTH No. is required for Full-Time employees.");
        }

        if (safeEmploymentType?.toLowerCase() === "part-time") {
            if (!safeStart) errors.push("Start of contract is required for Part-Time employees.");
            if (!safeEnd) errors.push("End of contract is required for Part-Time employees.");
            if (safeStart && safeEnd && new Date(safeEnd) < new Date(safeStart)) {
                errors.push("End of contract cannot be before start of contract.");
            }
        }

        if (!safeContact || !phoneRegex.test(safeContact)) errors.push("Invalid contact number.");
        if (!safeEmergencyContact || !phoneRegex.test(safeEmergencyContact)) errors.push("Invalid emergency contact number.");
        if (safeGcash && !phoneRegex.test(safeGcash)) errors.push("GCash number must start with 09 and be 11 digits.");
        if (safePostal && !postalRegex.test(safePostal)) errors.push("Postal code must be 4–5 digits only.");
        if (safeCity && !textRegex.test(safeCity)) errors.push("City must contain only letters.");
        if (safeRelationship && !textRegex.test(safeRelationship)) errors.push("Relationship must contain only letters.");

        if (errors.length > 0) return reply.status(400).send({ errors });

        const firstName = safeFullname.split(" ")[0]?.toUpperCase();
        const birthYear = new Date(safeBirthday).getFullYear();
        const tempPassword = `${firstName}-${birthYear}`;
        const hashedPassword = await bcrypt.hash(tempPassword, 10);

        const client = await pool.connect();
        try {
            await client.query("BEGIN");

            const empRes = await client.query(`
                INSERT INTO employees 
                (fullname, nickname, email, position, employment_type, status, gender, contact, marital_status, birthday, address, sss_number, pagibig, philhealth)
                VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
                RETURNING *;
            `, [safeFullname, safeNickname, safeEmail, safePosition || '', safeEmploymentType, safeStatus, safeGender, safeContact, safeMarital, safeBirthday, safeAddress, safeSSS, safePagibig, safePhilhealth]);

            const employee = empRes.rows[0];

            // Fire-and-forget DB inserts
            if (safeEmploymentType?.toLowerCase() === "part-time") {
                client.query(`
                    INSERT INTO employee_contracts
                    (employee_id, start_of_contract, end_of_contract, contract_type)
                    VALUES ($1,$2,$3,$4)
                `, [employee.employee_id, safeStart, safeEnd, "Part-Time"]);
            }

            client.query(`
                INSERT INTO employee_dependents 
                (employee_id, fullname, relationship, address, contact, city, postalcode, gcash_number)
                VALUES ($1,$2,$3,$4,$5,$6,$7,$8);
            `, [employee.employee_id, safeEmergencyName, safeRelationship, safeEmergencyAddress, safeEmergencyContact, safeCity, safePostal, safeGcash]);

            client.query(`
                INSERT INTO employee_account
                (employee_id, email, password, must_change_password)
                VALUES ($1, $2, $3, true);
            `, [employee.employee_id, safeEmail, hashedPassword]);

            await client.query("COMMIT");

            // Fire-and-forget email
            sendEmployeeEmail(safeEmail, safeFullname, employee.employee_id, tempPassword)
                .catch(err => console.warn("Email not sent:", err.message));

            return reply.send({ success: true, employee });

        } catch (err) {
            await client.query("ROLLBACK");
            if (err.code === "23505") {
                if (err.constraint === "unique_fullname") return reply.status(400).send({ message: "Name already exists" });
                if (err.constraint === "unique_email") return reply.status(400).send({ message: "Email already exists" });
            }
            console.error("Insert Error:", err.message);
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

            // Combined email check
            const arcRes = await client.query(
                `SELECT 1 FROM employees_archive WHERE email = $1 AND employee_id != $2`, 
                [email, id]
            );
            const employeeRes = await client.query(
                `SELECT 1 FROM employees WHERE email = $1 AND employee_id != $2`, 
                [email, id]
            );

            if (arcRes.rowCount > 0 || employeeRes.rowCount > 0) {
                return reply.status(400).send({ field: "email", message: "Email is already used." });
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
            `, [fullname, nickname, email, position, employment_type, status, gender, contact, marital_status, birthday, address, sss_no, pagibig_no, philhealth_no, id]);

            const updatedEmployee = updateRes.rows[0];

            await client.query(`
                UPDATE employee_dependents
                SET fullname=$1, relationship=$2, address=$3, contact=$4,
                    city=$5, postalcode=$6, gcash_number=$7
                WHERE employee_id=$8;
            `, [emergency_name, relationship, emergency_address, emergency_contact, city, postal_code, gcash_no, id]);
            
            if (contract_date && contract_type){
                await client.query(`
                    INSERT INTO employee_contracts(employee_id, end_of_contract, contract_type)
                    VALUES ($1, $2, $3);
                `, [id, contract_date, contract_type]);
            }

            await client.query('COMMIT');
            
            if (oldEmployee.email !== email) {
                const firstName = fullname.split(" ")[0]?.toUpperCase();
                const birthYear = new Date(birthday).getFullYear();
                const tempPassword = `${firstName}-${birthYear}`;
                sendEmployeeEmail(email, fullname, updatedEmployee.employee_id, tempPassword)
                    .catch(err => console.warn("Email not sent:", err.message));
            }

            reply.send({ success: true, employee: updatedEmployee });

        } catch (err) {
            await client.query('ROLLBACK');
            if(err.code === "23505"){
                if(err.constraint === "unique_fullname") return reply.status(400).send({ message: "Name already exists" });
                if(err.constraint === "unique_email") return reply.status(400).send({ message: "Email already exists" });
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
            await client.query('BEGIN');

            const res = await client.query('SELECT * FROM employees WHERE employee_id = $1', [id]);
            if (!res.rowCount) return reply.status(404).send({ error: 'Employee not found' });

            await client.query(
                'UPDATE employees SET effective_deletion_date = $1, deletion_status = $2 WHERE employee_id = $3',
                [deletion_date, status, id]
            );

            await client.query('COMMIT');

            scheduleEmployeeDeletion(pool, { ...res.rows[0], effective_deletion_date: deletion_date, status });

            reply.send({ message: `Employee ${id} scheduled for deletion on ${deletion_date}` });
        } catch (err) {
            await client.query('ROLLBACK');
            console.error(err);
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
