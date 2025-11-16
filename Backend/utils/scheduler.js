// utils/scheduleAutomation.js
import { pool } from "../db/pool.js";
import cron from "node-cron";
import { syncRow, deleteRow } from "./syncToSupabase.js";
import { sendAvailabilityReminderEmail, sendScheduleFinalizedEmail } from "./sendEmail.js";
import { getIo } from "../socket.js";

/**
 * Constants / Shift definitions
 * All employees (FT & PT) work 5-hour shifts
 */
const SHIFTS = {
	opening: { start: "09:00:00", end: "14:00:00", hours: 5 },
	closing: { start: "18:00:00", end: "23:00:00", hours: 5 }
};

function isoDate(d) {
	return d.toISOString().slice(0, 10);
}

async function getNextWeekDates() {
	const today = new Date();
	const day = today.getDay();
	const daysUntilNextMonday = ((8 - day) % 7) || 7;
	const base = new Date(today);
	base.setDate(base.getDate() + daysUntilNextMonday);

	const arr = [];
	for (let i = 0; i < 7; i++) {
		const d = new Date(base);
		d.setDate(base.getDate() + i);
		arr.push(d);
	}
	return arr;
}

/**
 * ✅ Send availability reminder every Thursday at 6:00 AM
 */
cron.schedule("0 6 * * 4", async () => {
	try {
		console.log("📧 Sending availability reminder emails...");

		// Get all active part-time employees
		const { rows: ptEmployees } = await pool.query(`
			SELECT employee_id, fullname, email
			FROM employees
			WHERE employment_type = 'Part-Time'
			  AND status IN ('Employed', 'Probationary')
		`);

		for (const emp of ptEmployees) {
			try {
				await sendAvailabilityReminderEmail(emp.email, emp.fullname);
				console.log(`✅ Reminder sent to ${emp.fullname}`);
			} catch (err) {
				console.error(`❌ Failed to send to ${emp.fullname}:`, err.message);
			}
		}

		console.log(`📧 Sent ${ptEmployees.length} availability reminders.`);
	} catch (err) {
		console.error("🔥 Availability reminder error:", err);
	}
});

/**
 * ✅ Finalize Schedules every Friday 11:59 PM
 * - Approve Part-Time availability requests (3 per shift)
 * - Auto-assign Full-Time employees to fill remaining slots (3 per shift)
 * - Total: 6 employees per day (3 opening + 3 closing)
 */
cron.schedule("59 23 * * 5", async () => {
	try {
		console.log("🛠️ Starting schedule finalization...");

		const nextWeekDates = await getNextWeekDates();
		const nextWeekStr = nextWeekDates.map(isoDate);
		const io = getIo();

		// Get Full-Time employees for auto-assignment
		const { rows: ftRows } = await pool.query(`
			SELECT employee_id, fullname, email
			FROM employees
			WHERE employment_type = 'Full-Time'
			  AND status IN ('Employed', 'Probationary')
			  AND (availability_disabled IS NULL OR availability_disabled = false)
			ORDER BY employee_id
		`);
		const ftEmployees = ftRows.map(r => ({ id: r.employee_id, name: r.fullname, email: r.email }));

		// Get historical hours for fair distribution
		const { rows: hist } = await pool.query(`
			SELECT s.employee_id,
				   COALESCE(SUM(EXTRACT(EPOCH FROM (s.end_time - s.start_time)) / 3600), 0) AS hours_last_49d
			FROM employee_schedule s
			WHERE s.status = 'approved'
			  AND s.work_date >= CURRENT_DATE - INTERVAL '49 days'
			GROUP BY s.employee_id
		`);

		const histMap = new Map(hist.map(r => [r.employee_id, Number(r.hours_last_49d)]));
		const assignedThisWeek = new Map();
		
		// Initialize tracking for all employees
		for (const emp of ftEmployees) {
			assignedThisWeek.set(emp.id, 0);
		}

		// ==========================================
		// Process each day of next week
		// ==========================================
		for (const work_date of nextWeekStr) {
			const opening = SHIFTS.opening;
			const closing = SHIFTS.closing;

			// ========== OPENING SHIFT (3 employees) ==========
			console.log(`\n📅 Processing ${work_date} - Opening Shift`);

			// Step 1: Approve Part-Time requests
			const { rows: openingApproved } = await pool.query(`
				SELECT COUNT(*) as count FROM employee_schedule
				WHERE work_date = $1 AND start_time = $2 AND end_time = $3 AND status = 'approved'
			`, [work_date, opening.start, opening.end]);

			let openingSlotsNeeded = 3 - parseInt(openingApproved[0].count);

			if (openingSlotsNeeded > 0) {
				// Approve pending PT requests
				const { rows: pendingOpening } = await pool.query(`
					SELECT s.*, e.fullname, e.email 
					FROM employee_schedule s
					JOIN employees e ON e.employee_id = s.employee_id
					WHERE s.work_date = $1
					  AND s.start_time = $2
					  AND s.end_time = $3
					  AND s.status = 'pending'
					  AND e.employment_type = 'Part-Time'
					ORDER BY s.created_at ASC
					LIMIT $4
				`, [work_date, opening.start, opening.end, openingSlotsNeeded]);

				for (const pick of pendingOpening) {
					const { rows: updated } = await pool.query(`
						UPDATE employee_schedule
						SET status = 'approved', updated_at = NOW()
						WHERE schedule_id = $1
						RETURNING *
					`, [pick.schedule_id]);

					if (updated.length > 0) {
						await syncRow("employee_schedule", updated[0], "employee_id,work_date");
						await sendScheduleFinalizedEmail(pick.email, pick.fullname, work_date, opening.start, opening.end);
						io.to(`employee_${pick.employee_id}`).emit('scheduleApproved', updated[0]);
						console.log(`  ✅ Approved PT: ${pick.fullname}`);
						openingSlotsNeeded--;
					}
				}
			}

			// Step 2: Fill remaining slots with Full-Time
			if (openingSlotsNeeded > 0 && ftEmployees.length > 0) {
				console.log(`  🔄 Filling ${openingSlotsNeeded} opening slots with FT...`);

				for (let i = 0; i < openingSlotsNeeded; i++) {
					let candidate = null;
					let minScore = Infinity;

					for (const emp of ftEmployees) {
						// Check if already assigned ANY shift this day
						const { rows: alreadyAssigned } = await pool.query(`
							SELECT 1 FROM employee_schedule
							WHERE employee_id = $1 AND work_date = $2 AND status = 'approved'
						`, [emp.id, work_date]);

						if (alreadyAssigned.length > 0) continue;

						const histHours = histMap.get(emp.id) || 0;
						const assignedHoursSoFar = assignedThisWeek.get(emp.id) || 0;
						const score = histHours + assignedHoursSoFar;

						if (score < minScore) {
							minScore = score;
							candidate = emp;
						}
					}

					if (!candidate) {
						console.log(`  ⚠️ No FT available for opening`);
						break;
					}

					const { rows: ins } = await pool.query(`
						INSERT INTO employee_schedule (employee_id, work_date, start_time, end_time, status, created_at, updated_at)
						VALUES ($1, $2, $3, $4, 'approved', NOW(), NOW())
						RETURNING *
					`, [candidate.id, work_date, opening.start, opening.end]);

					if (ins.length > 0) {
						await syncRow("employee_schedule", ins[0], "employee_id,work_date");
						await sendScheduleFinalizedEmail(candidate.email, candidate.name, work_date, opening.start, opening.end);
						assignedThisWeek.set(candidate.id, assignedThisWeek.get(candidate.id) + opening.hours);
						console.log(`  ✅ FT assigned: ${candidate.name}`);
					}
				}
			}

			// ========== CLOSING SHIFT (3 employees) ==========
			console.log(`\n📅 Processing ${work_date} - Closing Shift`);

			// Step 1: Approve Part-Time requests
			const { rows: closingApproved } = await pool.query(`
				SELECT COUNT(*) as count FROM employee_schedule
				WHERE work_date = $1 AND start_time = $2 AND end_time = $3 AND status = 'approved'
			`, [work_date, closing.start, closing.end]);

			let closingSlotsNeeded = 3 - parseInt(closingApproved[0].count);

			if (closingSlotsNeeded > 0) {
				// Approve pending PT requests
				const { rows: pendingClosing } = await pool.query(`
					SELECT s.*, e.fullname, e.email 
					FROM employee_schedule s
					JOIN employees e ON e.employee_id = s.employee_id
					WHERE s.work_date = $1
					  AND s.start_time = $2
					  AND s.end_time = $3
					  AND s.status = 'pending'
					  AND e.employment_type = 'Part-Time'
					ORDER BY s.created_at ASC
					LIMIT $4
				`, [work_date, closing.start, closing.end, closingSlotsNeeded]);

				for (const pick of pendingClosing) {
					const { rows: updated } = await pool.query(`
						UPDATE employee_schedule
						SET status = 'approved', updated_at = NOW()
						WHERE schedule_id = $1
						RETURNING *
					`, [pick.schedule_id]);

					if (updated.length > 0) {
						await syncRow("employee_schedule", updated[0], "employee_id,work_date");
						await sendScheduleFinalizedEmail(pick.email, pick.fullname, work_date, closing.start, closing.end);
						io.to(`employee_${pick.employee_id}`).emit('scheduleApproved', updated[0]);
						console.log(`  ✅ Approved PT: ${pick.fullname}`);
						closingSlotsNeeded--;
					}
				}
			}

			// Step 2: Fill remaining slots with Full-Time
			if (closingSlotsNeeded > 0 && ftEmployees.length > 0) {
				console.log(`  🔄 Filling ${closingSlotsNeeded} closing slots with FT...`);

				for (let i = 0; i < closingSlotsNeeded; i++) {
					let candidate = null;
					let minScore = Infinity;

					for (const emp of ftEmployees) {
						// Check if already assigned ANY shift this day
						const { rows: alreadyAssigned } = await pool.query(`
							SELECT 1 FROM employee_schedule
							WHERE employee_id = $1 AND work_date = $2 AND status = 'approved'
						`, [emp.id, work_date]);

						if (alreadyAssigned.length > 0) continue;

						const histHours = histMap.get(emp.id) || 0;
						const assignedHoursSoFar = assignedThisWeek.get(emp.id) || 0;
						const score = histHours + assignedHoursSoFar;

						if (score < minScore) {
							minScore = score;
							candidate = emp;
						}
					}

					if (!candidate) {
						console.log(`  ⚠️ No FT available for closing`);
						break;
					}

					const { rows: ins } = await pool.query(`
						INSERT INTO employee_schedule (employee_id, work_date, start_time, end_time, status, created_at, updated_at)
						VALUES ($1, $2, $3, $4, 'approved', NOW(), NOW())
						RETURNING *
					`, [candidate.id, work_date, closing.start, closing.end]);

					if (ins.length > 0) {
						await syncRow("employee_schedule", ins[0], "employee_id,work_date");
						await sendScheduleFinalizedEmail(candidate.email, candidate.name, work_date, closing.start, closing.end);
						assignedThisWeek.set(candidate.id, assignedThisWeek.get(candidate.id) + closing.hours);
						console.log(`  ✅ FT assigned: ${candidate.name}`);
					}
				}
			}

			// ========== REJECT LEFTOVER PENDING ==========
			const { rows: leftoverPending } = await pool.query(`
				SELECT s.*, e.email, e.fullname
				FROM employee_schedule s
				JOIN employees e ON e.employee_id = s.employee_id
				WHERE s.work_date = $1
				  AND s.status = 'pending'
				  AND e.employment_type = 'Part-Time'
			`, [work_date]);

			for (const p of leftoverPending) {
				const { rows: updated } = await pool.query(`
					UPDATE employee_schedule
					SET status = 'rejected', updated_at = NOW()
					WHERE schedule_id = $1
					RETURNING *
				`, [p.schedule_id]);

				if (updated.length > 0) {
					await syncRow("employee_schedule", updated[0], "employee_id,work_date");
					io.to(`employee_${p.employee_id}`).emit('scheduleRejected', updated[0]);
					console.log(`  ❌ Rejected PT: ${p.fullname}`);
				}
			}
		}

		// Emit real-time update
		io.emit('scheduleUpdated', { message: 'All schedules finalized', dates: nextWeekStr });

		console.log("\n✅ Schedule finalization complete.");
		console.log("📊 Summary:");
		for (const [empId, hours] of assignedThisWeek) {
			if (hours > 0) {
				const emp = ftEmployees.find(e => e.id === empId);
				console.log(`  ${emp?.name || empId}: ${hours} hours`);
			}
		}
	} catch (err) {
		console.error("🔥 Schedule finalization error:", err);
	}
});

/**
 * Cleanup old schedules weekly (Sunday 03:00 AM)
 */
cron.schedule("0 3 * * 0", async () => {
	try {
		console.log("🧹 Cleaning old schedules...");
		const { rows: oldRows } = await pool.query(`
			SELECT schedule_id
			FROM employee_schedule
			WHERE status IN ('rejected', 'pending')
			  AND work_date < CURRENT_DATE - INTERVAL '90 days'
		`);

		if (oldRows.length > 0) {
			await pool.query(`
				DELETE FROM employee_schedule
				WHERE status IN ('rejected', 'pending')
				  AND work_date < CURRENT_DATE - INTERVAL '90 days'
			`);

			for (const r of oldRows) {
				try {
					await deleteRow("employee_schedule", "schedule_id", r.schedule_id);
				} catch (e) {
					console.warn("deleteRow warning:", e?.message || e);
				}
			}
		}

		console.log(`🧹 Removed: ${oldRows.length} rows`);
	} catch (err) {
		console.error("🔥 Cleanup error:", err);
	}
});