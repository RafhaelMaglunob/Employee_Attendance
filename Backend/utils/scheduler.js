// utils/scheduleAutomation.js
import { pool } from "../db/pool.js";
import cron from "node-cron";
import { syncRow, deleteRow } from "./syncToSupabase.js";
import { sendAvailabilityReminderEmail, sendScheduleFinalizedEmail } from "./sendEmail.js";
import { getIo } from "../socket.js";

/**
 * Constants / Shift definitions
 */
const SHIFTS = {
	opening: { start: "09:00:00", end: "14:00:00", hours: 5 },
	closingPT: { start: "18:00:00", end: "23:00:00", hours: 5 },
	openingFT: { start: "09:00:00", end: "18:00:00", hours: 9 },
	closingFT: { start: "14:00:00", end: "23:00:00", hours: 9 }
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
 * ✅ Auto-assign Full-Time employees (runs every Friday at 11:59 PM)
 */
cron.schedule("59 23 * * 5", async () => {
	try {
		console.log("🗓️ Auto-assign Full-Time: Starting...");

		const { rows: ftRows } = await pool.query(`
			SELECT employee_id, fullname, email
			FROM employees
			WHERE employment_type = 'Full-Time'
			  AND status IN ('Employed', 'Probationary')
			  AND (availability_disabled IS NULL OR availability_disabled = false)
			ORDER BY employee_id
		`);
		const ftEmployees = ftRows.map(r => ({ id: r.employee_id, name: r.fullname, email: r.email }));
		
		if (ftEmployees.length === 0) {
			console.log("No full-time employees available.");
			return;
		}

		const { rows: hist } = await pool.query(`
			SELECT s.employee_id,
				   COALESCE(SUM(EXTRACT(EPOCH FROM (s.end_time - s.start_time)) / 3600), 0) AS hours_last_49d
			FROM employee_schedule s
			WHERE s.status = 'approved'
			  AND s.work_date >= CURRENT_DATE - INTERVAL '49 days'
			GROUP BY s.employee_id
		`);

		const histMap = new Map(hist.map(r => [r.employee_id, Number(r.hours_last_49d)]));
		const assignedThisWeek = new Map(ftEmployees.map(emp => [emp.id, 0]));

		const nextWeekDates = await getNextWeekDates();
		const nextWeekStr = nextWeekDates.map(isoDate);

		// Clear old schedules
		const { rows: toDelete } = await pool.query(`
			SELECT schedule_id
			FROM employee_schedule
			WHERE work_date = ANY($1::date[])
			  AND status = 'approved'
			  AND employee_id IN (
				  SELECT employee_id FROM employees WHERE employment_type = 'Full-Time'
			  )
		`, [nextWeekStr]);

		if (toDelete.length > 0) {
			await pool.query(`
				DELETE FROM employee_schedule
				WHERE work_date = ANY($1::date[])
				  AND status = 'approved'
				  AND employee_id IN (
					  SELECT employee_id FROM employees WHERE employment_type = 'Full-Time'
				  )
			`, [nextWeekStr]);

			for (const r of toDelete) {
				try {
					await deleteRow("employee_schedule", "schedule_id", r.schedule_id);
				} catch (e) {
					console.warn("deleteRow warning:", e?.message || e);
				}
			}
			console.log(`🧹 Cleared ${toDelete.length} previous FT schedule rows.`);
		}

		// Assign schedules
		for (let i = 0; i < nextWeekStr.length; i++) {
			const work_date = nextWeekStr[i];
			const shiftKey = (i % 2 === 0) ? "openingFT" : "closingFT";
			const shift = SHIFTS[shiftKey];

			let candidate = null;
			let minScore = Infinity;

			for (const emp of ftEmployees) {
				const histHours = histMap.get(emp.id) || 0;
				const assignedHoursSoFar = assignedThisWeek.get(emp.id) || 0;
				const assignedDaysSoFar = Math.round(assignedHoursSoFar / shift.hours);

				if (assignedDaysSoFar >= 5) continue;

				const score = histHours + assignedHoursSoFar;
				if (score < minScore) {
					minScore = score;
					candidate = emp;
				}
			}

			if (!candidate) {
				console.log(`⚠️ No full-time available for ${work_date}`);
				continue;
			}

			const { rows: ins } = await pool.query(`
				INSERT INTO employee_schedule (employee_id, work_date, start_time, end_time, status, created_at, updated_at)
				VALUES ($1, $2, $3, $4, 'approved', NOW(), NOW())
				ON CONFLICT (employee_id, work_date)
				DO UPDATE SET
					start_time = EXCLUDED.start_time,
					end_time = EXCLUDED.end_time,
					status = EXCLUDED.status,
					updated_at = NOW()
				RETURNING *
			`, [candidate.id, work_date, shift.start, shift.end]);

			if (ins.length > 0) {
				try {
					await syncRow("employee_schedule", ins[0], "employee_id,work_date");
				} catch (e) {
					console.warn("syncRow warning:", e?.message || e);
				}
			}

			assignedThisWeek.set(candidate.id, assignedThisWeek.get(candidate.id) + shift.hours);
			console.log(`FT assigned: ${candidate.name} | ${work_date} | ${shiftKey}`);

			// Send email notification
			try {
				await sendScheduleFinalizedEmail(candidate.email, candidate.name, work_date, shift.start, shift.end);
			} catch (err) {
				console.error(`Failed to send schedule email to ${candidate.name}`);
			}
		}

		// Emit real-time update to all admins
		const io = getIo();
		io.emit('scheduleUpdated', { message: 'Full-time schedules updated', dates: nextWeekStr });

		console.log("✅ Full-Time auto-assignment complete.");
	} catch (err) {
		console.error("🔥 Auto-assign FT error:", err);
	}
});

/**
 * ✅ Finalize Part-Time requests every Friday 11:59 PM
 */
cron.schedule("59 23 * * 5", async () => {
	try {
		console.log("🛠️ Finalizing Part-Time schedules...");

		const nextWeekDates = await getNextWeekDates();
		const nextWeekStr = nextWeekDates.map(isoDate);
		const io = getIo();

		for (const work_date of nextWeekStr) {
			const o = SHIFTS.opening;
			const c = SHIFTS.closingPT;

			// Check opening slot
			const { rows: openingApproved } = await pool.query(`
				SELECT 1 FROM employee_schedule
				WHERE work_date = $1 AND start_time = $2 AND end_time = $3 AND status = 'approved'
			`, [work_date, o.start, o.end]);

			// Check closing slot
			const { rows: closingApproved } = await pool.query(`
				SELECT 1 FROM employee_schedule
				WHERE work_date = $1 AND start_time = $2 AND end_time = $3 AND status = 'approved'
			`, [work_date, c.start, c.end]);

			// Approve opening PT
			if (openingApproved.length === 0) {
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
					LIMIT 1
				`, [work_date, o.start, o.end]);

				if (pendingOpening.length > 0) {
					const pick = pendingOpening[0];
					const { rows: updated } = await pool.query(`
						UPDATE employee_schedule
						SET status = 'approved', updated_at = NOW()
						WHERE schedule_id = $1
						RETURNING *
					`, [pick.schedule_id]);

					if (updated.length > 0) {
						await syncRow("employee_schedule", updated[0], "employee_id,work_date");
						await sendScheduleFinalizedEmail(pick.email, pick.fullname, work_date, o.start, o.end);
						
						// Real-time notification
						io.to(`employee_${pick.employee_id}`).emit('scheduleApproved', updated[0]);
						
						console.log(`✅ Approved PT opening: ${pick.fullname} on ${work_date}`);
					}
				}
			}

			// Approve closing PT
			if (closingApproved.length === 0) {
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
					LIMIT 1
				`, [work_date, c.start, c.end]);

				if (pendingClosing.length > 0) {
					const pick = pendingClosing[0];
					const { rows: updated } = await pool.query(`
						UPDATE employee_schedule
						SET status = 'approved', updated_at = NOW()
						WHERE schedule_id = $1
						RETURNING *
					`, [pick.schedule_id]);

					if (updated.length > 0) {
						await syncRow("employee_schedule", updated[0], "employee_id,work_date");
						await sendScheduleFinalizedEmail(pick.email, pick.fullname, work_date, c.start, c.end);
						
						io.to(`employee_${pick.employee_id}`).emit('scheduleApproved', updated[0]);
						
						console.log(`✅ Approved PT closing: ${pick.fullname} on ${work_date}`);
					}
				}
			}

			// Reject leftover pending
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
					console.log(`❌ Rejected PT: ${p.fullname} on ${work_date}`);
				}
			}
		}

		console.log("✅ Part-Time finalization completed.");
	} catch (err) {
		console.error("🔥 Finalize PT error:", err);
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