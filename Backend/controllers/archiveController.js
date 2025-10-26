import { syncRow, restoreRow } from "../utils/syncToSupabase.js";
import { sendEmployeeActivatedEmail } from "../utils/sendEmail.js";
import { scheduleEmployeeRestoration } from "../utils/EmployeeRestoreScheduler.js";

export function archiveController(pool) {
	const getAllArchives = async (req, reply) => {
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
					END AS documents_complete_archive
				FROM employees_archive
				ORDER BY employee_id ASC;
			`);
			return { success: true, data: result.rows };
		} catch (err) {
			console.error("Database Error:", err.message);
			reply.status(500).send({ error: "Failed to fetch all archive" });
		}
	};

	const getSingleArchiveEmployee = async (req, reply) => {
		const { id } = req.params;
		try {
			const empRes = await pool.query(
				"SELECT * FROM employees_archive WHERE employee_id = $1",
				[id]
			);
			if (!empRes.rows.length)
				return reply.status(404).send({ error: "Employee not found in archive" });

			const employee = empRes.rows[0];

			const [dependentsRes, contractsRes, documentsRes] = await Promise.all([
				pool.query("SELECT * FROM employee_dependents_archive WHERE employee_id = $1", [id]),
				pool.query("SELECT * FROM employee_contracts_archive WHERE employee_id = $1", [id]),
				pool.query("SELECT * FROM employee_documents_archive WHERE employee_id = $1", [id])
			]);

			const dependents = dependentsRes.rows;
			const contracts = contractsRes.rows;
			const documents = documentsRes.rows;
			const primaryDependent = dependents[0] || {};

			reply.send({
				...employee,
				emergency_name: primaryDependent.fullname || null,
				relationship: primaryDependent.relationship || null,
				emergency_address: primaryDependent.address || null,
				emergency_contact: primaryDependent.contact || null,
				city: primaryDependent.city || null,
				postal_code: primaryDependent.postalcode || null,
				gcash_no: primaryDependent.gcash_number || null,
				contracts,
				dependents,
				documents,
			});
		} catch (err) {
			console.error("Database Error:", err.message);
			reply.status(500).send({ error: "Failed to fetch target archive" });
		}
	};

	const getSingleArchiveContract = async (req, reply) => {
		const { id } = req.params;
		try {
			const conRes = await pool.query(`
				SELECT 
					TO_CHAR(start_of_contract, 'FMMonth DD, YYYY') AS start_of_contract,
					TO_CHAR(end_of_contract, 'FMMonth DD, YYYY') AS end_of_contract
				FROM employee_contracts_archive 
				WHERE employee_id = $1
			`, [id]);
			return { success: true, data: conRes.rows || [] };
		} catch (err) {
			console.error("Database error: ", err.message);
			reply.status(500).send({ message: "Fetching employee contract failed." });
		}
	};

	const retrieveEmployee = async (req, reply) => {
		const { id } = req.params;
		const { status, contract_type, start_date, end_date } = req.body;

		if (!start_date || isNaN(new Date(start_date))) {
			return reply.status(400).send({ error: "Invalid start date" });
		}
		if (!status || !contract_type) {
			return reply.status(400).send({ error: "Missing required fields: status or contract_type" });
		}

		const client = await pool.connect();
		try {
			await client.query("BEGIN");

			// Fetch employee from archive
			const empRes = await client.query(
				"SELECT * FROM employees_archive WHERE employee_id = $1",
				[id]
			);
			if (!empRes.rowCount) {
				await client.query("ROLLBACK");
				return reply.status(404).send({ error: "Employee not found in archive" });
			}
			const employee = empRes.rows[0];

			// Update employee archive with new status and employment_type
			await client.query(
				`UPDATE employees_archive
				SET status = $1,
					current_status = $1,
					employment_type = $2
				WHERE employee_id = $3`,
				[status, contract_type, id]
			);
			
			await client.query("COMMIT");
			
			// Insert contract info
			const normalizedStartDate = start_date
				? new Date(start_date).toISOString().split('T')[0] // YYYY-MM-DD
				: new Date().toISOString().split('T')[0];

			const normalizedEndDate = contract_type.toLowerCase() === 'full-time'
				? null
				: end_date
					? new Date(end_date).toISOString().split('T')[0]
					: null;
			
			// Pass updated employee object to scheduler
			await scheduleEmployeeRestoration(pool, {
				...employee,
				status,
				employment_type: contract_type,
				start_date: normalizedStartDate,
				end_date: normalizedEndDate,
				contract_type,
				email: employee.email,
				fullname: employee.fullname
			});


				reply.send({
				message: `Employee ${id} scheduled for restoration on ${start_date}`,
			});
		} catch (err) {
			await client.query("ROLLBACK");
			console.error("❌ Restore employee failed:", err.message);
			reply.status(500).send({ error: "Failed to schedule employee restoration" });
		} finally {
			client.release();
		}
	};





	return {
		getAllArchives,
		getSingleArchiveEmployee,
		getSingleArchiveContract,
		retrieveEmployee,
	};
}
