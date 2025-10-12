export async function employeeRoutes(fastify, options) {
    const pool = fastify.pg;

    // Get all employees
    fastify.get('/employees', async (req, reply) => {
        try {
            const result = await pool.query(`
                SELECT *,
                CASE
                    WHEN fullname IS NOT NULL
                    AND nickname IS NOT NULL
                    AND email IS NOT NULL
                    AND position IS NOT NULL
                    AND employment_type IS NOT NULL
                    AND gender IS NOT NULL
                    AND contact IS NOT NULL
                    AND marital_status IS NOT NULL
                    AND birthday IS NOT NULL
                    AND address IS NOT NULL
                    AND sss_number IS NOT NULL
                    AND pagibig IS NOT NULL
                    AND philhealth IS NOT NULL
                    THEN true
                    ELSE false
                END AS documents_complete
                FROM employees
                ORDER BY employee_id ASC;
            `);

            return Array.isArray(result.rows) ? result.rows : [];
        } catch (err) {
            console.error("Database Error:", err.message);
            reply.status(500).send({ error: "Database query failed" });
        }
    });

    // Add employee
    fastify.post('/employees', async (req, reply) => {
        const {
            fullname, nickname, email, position, employment_type, status, gender,
            contact, marital_status, birthday, address, sss_no, pagibig_no, philhealth_no,
            emergency_name, relationship, emergency_address, emergency_contact,
            city, postal_code, gcash_no
        } = req.body;

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
    });

    // Get single employee with emergency
    fastify.get('/employees/:id', async (req, reply) => {
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
    });

    // Update employee
    fastify.put('/employees/:id', async (req, reply) => {
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
            console.error("Update Error:", err.message);
            reply.status(500).send({ error: "Failed to update employee" });
        } finally {
            client.release();
        }
    });

    // Delete employee
    fastify.delete("/employees/:id", async (req, reply) => {
        const { id } = req.params;
        try {
            const client = await pool.connect();
            await client.query("DELETE FROM employees WHERE employee_id = $1", [id]);
            client.release();
            reply.send({ message: `Employee ${id} deleted successfully` });
        } catch (err) {
            console.error(err);
            reply.status(500).send({ error: "Failed to delete employee" });
        }
    });
}
