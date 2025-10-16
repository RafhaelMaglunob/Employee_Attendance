import bcrypt from 'bcrypt'
import nodemailer from 'nodemailer'
import crypto from 'crypto'
import { sendEmployeeEmail } from '../utils/sendEmail.js';

import { scheduleEmployeeDeletion } from '../utils/employeeDeletionScheduler.js';

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
        const firstName = fullname.split(" ")[0]?.toUpperCase();
        const birthYear = new Date(birthday).getFullYear();
        const tempPassword = firstName + '-' + birthYear;
        const hashedPassword = await bcrypt.hash(tempPassword, 10);

        const phoneRegex = /^09\d{9}$/;
        const birthdate = new Date(birthday);
        const today = new Date();
        
        if (employment_type?.toLowerCase() === "full-time") {
            if (!sss_no) errors.push("SSS No. is required for Full-Time employees.");
            if (!pagibig_no) errors.push("PAG-IBIG No. is required for Full-Time employees.");
            if (!philhealth_no) errors.push("PHILHEALTH No. is required for Full-Time employees.");
        }

        if (employment_type?.toLowerCase() === "part-time") {
            if (!start_of_contract) errors.push("Start of contract is required for Part-Time employees.");
            if (!end_of_contract) errors.push("End of contract is required for Part-Time employees.");
            if (start_of_contract && end_of_contract && new Date(end_of_contract) < new Date(start_of_contract)) {
                errors.push("End of contract cannot be before start of contract.");
            }
        }

        if (!birthday) errors.push("Birthday is required.");
        else if (birthdate > today) errors.push("Birthday cannot be in the future.");

        if (!contact) errors.push("Contact number is required.");
        else if (!phoneRegex.test(contact)) errors.push("Contact number must start with 09 and be 11 digits.");

        if (!emergency_contact) errors.push("Emergency contact number is required.");
        else if (!phoneRegex.test(emergency_contact)) errors.push("Emergency contact number must start with 09 and be 11 digits.");

        if (!/^\d*$/.test(postal_code)) errors.push("Postal code must contain numbers only.");

        if (gcash_no && !phoneRegex.test(gcash_no)) errors.push("GCash number must start with 09 and be 11 digits.");

        if (errors.length > 0) {
            return reply.status(400).send({ message: errors.join(" ") });
        }

        const client = await pool.connect();
        try {
            await client.query('BEGIN');

            const empRes = await client.query(`
                INSERT INTO employees 
                (fullname, nickname, email, position, employment_type, status, gender, contact, marital_status, birthday, address, sss_number, pagibig, philhealth)
                VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
                RETURNING *;
            `, [fullname, nickname, email, position || '', employment_type, status, gender, contact, marital_status, birthday, address, sss_no, pagibig_no, philhealth_no]);

            const employee = empRes.rows[0];

            if (employment_type?.toLowerCase() === "part-time") {
                await client.query(`
                    INSERT INTO employee_contracts
                    (employee_id, start_of_contract, end_of_contract, contract_type)
                    VALUES ($1,$2,$3,$4)
                `, [employee.employee_id, start_of_contract, end_of_contract, "Part-Time"]);
            }

            await client.query(`
                INSERT INTO employee_dependents 
                (employee_id, fullname, relationship, address, contact, city, postalcode, gcash_number)
                VALUES ($1,$2,$3,$4,$5,$6,$7,$8);
            `, [employee.employee_id, emergency_name, relationship, emergency_address, emergency_contact, city, postal_code, gcash_no]);

            await client.query(`
                INSERT INTO employee_account
                (employee_id, email, password, must_change_password)
                VALUES ($1, $2, $3, true);
            `, [employee.employee_id, employee.employee_id, hashedPassword]);
            

            await client.query('COMMIT');

            sendEmployeeEmail(email, fullname, employee.employee_id, tempPassword);
            return { success: true, employee };
        } catch (err) {
            await client.query('ROLLBACK');
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
            if (empRes.rows.length === 0) return reply.status(404).send({ error: "Employee not found" });
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

        try{
            const conRes = await pool.query(`
                SELECT 
                TO_CHAR(start_of_contract, 'FMMonth DD, YYYY') as start_of_contract,
                TO_CHAR(end_of_contract, 'FMMonth DD, YYYY') as end_of_contract
                FROM employee_contracts WHERE employee_id = $1
                `, [id])
            const contract = conRes.rows || {};

            return ({ success: true, data: contract});
        }
        catch(err) {
            console.error("Database error: ", err.message)
            return reply.status(500).send({ message: "Fetching employee contract failed."})
        }
    }

    const updateEmployee = async (req, reply) => {
        const { id } = req.params;
        const client = await pool.connect();
        const {
            fullname, nickname, email, position, employment_type, status, gender,
            contact, marital_status, birthday, address, sss_no, pagibig_no, philhealth_no,
            emergency_name, relationship, emergency_address, emergency_contact,
            city, postal_code, gcash_no
        } = req.body;

        try {
            await client.query('BEGIN');

            const empRes = await client.query(`
                UPDATE employees
                SET fullname=$1, nickname=$2, email=$3, position=$4, employment_type=$5,
                    status=$6, gender=$7, contact=$8, marital_status=$9, birthday=$10,
                    address=$11, sss_number=$12, pagibig=$13, philhealth=$14
                WHERE employee_id=$15
                RETURNING *;
            `, [fullname, nickname, email, position, employment_type, status, gender, contact, marital_status, birthday, address, sss_no, pagibig_no, philhealth_no, id]);

            const updatedEmployee = empRes.rows[0];
            if (!updatedEmployee) throw new Error("Employee not found");

            await client.query(`
                UPDATE employee_dependents
                SET fullname=$1, relationship=$2, address=$3, contact=$4,
                    city=$5, postalcode=$6, gcash_number=$7
                WHERE employee_id=$8;
            `, [emergency_name, relationship, emergency_address, emergency_contact, city, postal_code, gcash_no, id]);

            await client.query('COMMIT');
            reply.send({ success: true, employee: updatedEmployee });
        } catch (err) {
            await client.query('ROLLBACK');
            if(err.code === "23505"){
                if(err.constraint === "unique_fullname") {
                    return reply.status(400).send({ message: "Name already exists"})
                } 
                else if (err.constraint === "unique_email") {
                    return reply.status(400).send({ message: "Email already exists" })
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
            await client.query('BEGIN');

            const res = await client.query(
                'SELECT * FROM employees WHERE employee_id = $1', [id]
            );
            if (res.rowCount === 0) {
                return reply.status(404).send({ error: 'Employee not found' });
            }

            await client.query(
                'UPDATE employees SET effective_deletion_date = $1, deletion_status = $2 WHERE employee_id = $3',
                [deletion_date, status, id]
            );

            await client.query('COMMIT');

            // Schedule deletion immediately
            scheduleEmployeeDeletion(pool, { 
                ...res.rows[0], 
                effective_deletion_date: deletion_date, 
                status 
            });

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
