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
            city, postal_code, gcash_no
        } = req.body;

        const client = await pool.connect();
        try {
            await client.query('BEGIN');

            const ifNameExist = await client.query(`
                SELECT email FROM employees WHERE fullname=$1
                UNION
                SELECT email FROM employees_archive WHERE fullname=$1
            `, [fullname])
                
            if (ifNameExist.rowCount > 0) {
                await client.query('ROLLBACK');
                return reply.status(400).send({ message: "Name already exists" });
            }

            const ifEmailExist = await client.query(`
                SELECT email FROM employees WHERE email=$1
                UNION
                SELECT email FROM employees_archive WHERE email=$1
            `, [email])

            if (ifEmailExist.rowCount > 0) {
                await client.query('ROLLBACK');
                return reply.status(400).send({ message: "Email already exists" });
            }

            const empRes = await client.query(`
                INSERT INTO employees 
                (fullname, nickname, email, position, employment_type, status, gender, contact, marital_status, birthday, address, sss_number, pagibig, philhealth)
                VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
                RETURNING *;
            `, [fullname, nickname, email, position || '', employment_type, status, gender, contact, marital_status, birthday, address, sss_no, pagibig_no, philhealth_no]);

            const employee = empRes.rows[0];

            await client.query(`
                INSERT INTO employee_dependents 
                (employee_id, fullname, relationship, address, contact, city, postalcode, gcash_number)
                VALUES ($1,$2,$3,$4,$5,$6,$7,$8);
            `, [employee.employee_id, emergency_name, relationship, emergency_address, emergency_contact, city, postal_code, gcash_no]);

            await client.query('COMMIT');

            return { success: true, employee };
        } catch (err) {
            await client.query('ROLLBACK');
            console.error("Insert Error:", err.message);
            reply.status(500).send({ error: "Failed to add employee" });
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
            const ifNameExist = await client.query(`
                SELECT * FROM employees WHERE fullname = $1
                UNION
                SELECT * FROM employees_archive WHERE fullname = $1
            `, [fullname])

            if(ifNameExist.rowCount > 0) {
                await client.query('ROLLBACK')
                return reply.status(400).send({ message: "Name is already exist"})
            } 

            const ifEmailExist = await client.query(`
                SELECT * FROM employees WHERE email = $1
                UNION
                SELECT * FROM employees_archive WHERE email = $1
            `, [email])

            if(ifEmailExist.rowCount > 0) {
                await client.query('ROLLBACK')
                return reply.status(400).send({ message: "Email is already exist"})
            }

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
            console.error("Update Error:", err.message);
            reply.status(500).send({ error: "Failed to update employee" });
        } finally {
            client.release();
        }
    };

    const deleteEmployee = async (req, reply) => {
        const { id } = req.params;
        try {
            const client = await pool.connect();
            
            // Archive employee
            await client.query(`
                INSERT INTO employees_archive (
                    employee_id, fullname, nickname, email, position, employment_type, status, gender, contact,
                    birthday, marital_status, address, sss_number, pagibig, philhealth, emergency_name,
                    relationship, emergency_address, emergency_contact, city, postal_code, gcash_no
                )
                SELECT 
                    employee_id, fullname, nickname, email, position, employment_type, status, gender, contact,
                    birthday, marital_status, address, sss_number, pagibig, philhealth, emergency_name,
                    relationship, emergency_address, emergency_contact, city, postal_code, gcash_no
                FROM employees WHERE employee_id = $1
            `, [id]);

            // Archive dependents
            await client.query(`
                INSERT INTO employee_dependents_archive (
                    dependent_id, employee_id, name, relationship, birthdate, contact
                )
                SELECT dependent_id, employee_id, name, relationship, birthdate, contact
                FROM employee_dependents WHERE employee_id = $1
            `, [id]);

            // Archive documents
            await client.query(`
                INSERT INTO employee_documents_archive (
                    document_id, employee_id, sss_id, resume_cv, pagibig, philhealth, barangay_clearance
                )
                SELECT document_id, employee_id, sss_id, resume_cv, pagibig, philhealth, barangay_clearance
                FROM employee_documents WHERE employee_id = $1
            `, [id]);
            await client.query("DELETE FROM employees WHERE employee_id = $1", [id]);
            client.release();
            
            reply.send({ message: `Employee ${id} archived and deleted successfully` });
        } catch (err) {
            console.error(err);
            reply.status(500).send({ error: "Failed to delete employee" });
        }
    };

    return {
        getAllEmployees,
        addEmployee,
        getSingleEmployee,
        updateEmployee,
        deleteEmployee
    };
}
