import { pool } from "../db/pool.js";
import cron from "node-cron";
import { syncRow, deleteRow } from "./syncToSupabase.js";

/**
 * Constants / Shift definitions
 */
const SHIFTS = {
	opening: { start: "09:00:00", end: "14:00:00", hours: 5 }, // part-time opening = 5h
	closingPT: { start: "18:00:00", end: "23:00:00", hours: 5 }, // part-time closing = 5h
	openingFT: { start: "09:00:00", end: "18:00:00", hours: 9 }, // full-time opening = 9h
	closingFT: { start: "14:00:00", end: "23:00:00", hours: 9 }  // full-time closing = 9h
};

/**
 * Helpers
 */
function isoDate(d) {
	return d.toISOString().slice(0, 10); // YYYY-MM-DD
}

async function getNextWeekDates() {
	const today = new Date();
	const day = today.getDay(); // 0 Sun .. 6 Sat
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
 * Auto-assign Full-Time employees for the next week.
 */
cron.schedule("*/5 * * * * 5", async () => {
	try {
		console.log("🗓️ Auto-assign Full-Time: Starting...");

		// 1) Get FT employees who are active
		const { rows: ftRows } = await pool.query(`
			SELECT employee_id
			FROM employees
			WHERE employment_type = 'Full-Time'
			  AND status IN ('Employed', 'Probationary')
			ORDER BY employee_id
		`);
		const ftEmployees = ftRows.map(r => r.employee_id);
		if (ftEmployees.length === 0) return console.log("No full-time employees found.");

		// 2) Compute historical hours fairness (last 49 days)
		const { rows: hist } = await pool.query(`
			SELECT s.employee_id,
				   COALESCE(SUM(EXTRACT(EPOCH FROM (s.end_time - s.start_time)) / 3600), 0) AS hours_last_49d
			FROM employee_schedule s
			WHERE s.status = 'approved'
			  AND s.work_date >= CURRENT_DATE - INTERVAL '49 days'
			GROUP BY s.employee_id
		`);

		const histMap = new Map(hist.map(r => [r.employee_id, Number(r.hours_last_49d)]));
		const assignedThisWeek = new Map(ftEmployees.map(id => [id, 0]));

		// 4) Dates next week
		const nextWeekDates = await getNextWeekDates();
		const nextWeekStr = nextWeekDates.map(isoDate);

		// 5) Clear old auto schedules (select rows first so we can call deleteRow)
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
			// delete from DB
			await pool.query(`
				DELETE FROM employee_schedule
				WHERE work_date = ANY($1::date[])
				  AND status = 'approved'
				  AND employee_id IN (
					  SELECT employee_id FROM employees WHERE employment_type = 'Full-Time'
				  )
			`, [nextWeekStr]);

			// sync deletes to Supabase
			for (const r of toDelete) {
				try {
					deleteRow("employee_schedule", "schedule_id", r.schedule_id);
				} catch (e) {
					console.warn("deleteRow warning:", e?.message || e);
				}
			}
			console.log(`🧹 Cleared ${toDelete.length} previous FT schedule rows and synced deletions.`);
		}

		// 6) Assign 1 FT per day (with required rest days)
		for (let i = 0; i < nextWeekStr.length; i++) {
			const work_date = nextWeekStr[i];
			const shiftKey = (i % 2 === 0) ? "openingFT" : "closingFT";
			const shift = SHIFTS[shiftKey];

			let candidate = null;
			let minScore = Infinity;

			for (const id of ftEmployees) {
				const histHours = histMap.get(id) || 0;
				const assignedHoursSoFar = assignedThisWeek.get(id) || 0;
				const assignedDaysSoFar = Math.round(assignedHoursSoFar / shift.hours);

				// Limit: Full-Time should only have 5 workdays (2 days off)
				if (assignedDaysSoFar >= 5) continue;

				const score = histHours + assignedHoursSoFar;
				if (score < minScore) {
					minScore = score;
					candidate = id;
				}
			}

			// If no candidate is eligible → skip (will backfill later)
			if (!candidate) {
				console.log(`⚠️ No full-time available for ${work_date}, leaving for backfill`);
				continue;
			}

			// Insert/update schedule and RETURN the final row to sync
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
			`, [candidate, work_date, shift.start, shift.end]);

			if (ins.length > 0) {
				try {
					await syncRow("employee_schedule", ins[0], "employee_id,work_date");
				} catch (e) {
					console.warn("syncRow warning:", e?.message || e);
				}
			}

			assignedThisWeek.set(candidate, assignedThisWeek.get(candidate) + shift.hours);
			console.log(`FT assigned: ${candidate} | ${work_date} | ${shiftKey}`);
		}

		// 7) Backfill missing FT days (ensure at least 1 FT per day)
		for (let i = 0; i < nextWeekStr.length; i++) {
			const work_date = nextWeekStr[i];

			const { rows: present } = await pool.query(`
				SELECT 1 FROM employee_schedule
				WHERE work_date = $1
				  AND employee_id IN (SELECT employee_id FROM employees WHERE employment_type = 'Full-Time')
				LIMIT 1
			`, [work_date]);

			if (present.length === 0) {
				// pick FT with least (historical + assignedThisWeek)
				let best = null;
				let lowest = Infinity;
				for (const id of ftEmployees) {
					const score = (histMap.get(id) || 0) + (assignedThisWeek.get(id) || 0);
					if (score < lowest) { lowest = score; best = id; }
				}

				// if still no best (shouldn't happen), skip
				if (!best) {
					console.warn("No FT available to backfill for", work_date);
					continue;
				}

				const shiftKey = (i % 2 === 0) ? "openingFT" : "closingFT";
				const shift = SHIFTS[shiftKey];

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
				`, [best, work_date, shift.start, shift.end]);

				if (ins.length > 0) {
					try {
						await syncRow("employee_schedule", ins[0], "employee_id,work_date");
					} catch (e) {
						console.warn("syncRow warning:", e?.message || e);
					}
				}

				assignedThisWeek.set(best, assignedThisWeek.get(best) + shift.hours);
				console.log(`🔄 Backfilled FT: ${best} | ${work_date} | ${shiftKey}`);
			}
		}

		console.log("✅ Full-Time auto-assignment complete.");
	} catch (err) {
		console.error("🔥 Auto-assign FT error:", err);
	}
});

/**
 * Finalize Part-Time requests every Friday 23:59
 */
cron.schedule("*/5 * * * * 5", async () => {
	try {
		console.log("🛠️ Finalizing Part-Time...");

		const nextWeekDates = await getNextWeekDates();
		const nextWeekStr = nextWeekDates.map(isoDate);

		for (const work_date of nextWeekStr) {
			const o = SHIFTS.opening;
			const c = SHIFTS.closingPT;

			const { rows: openingApproved } = await pool.query(`
				SELECT 1 FROM employee_schedule
				WHERE work_date = $1 AND start_time = $2 AND end_time = $3 AND status = 'approved'
			`, [work_date, o.start, o.end]);

			const { rows: closingApproved } = await pool.query(`
				SELECT 1 FROM employee_schedule
				WHERE work_date = $1 AND start_time = $2 AND end_time = $3 AND status = 'approved'
			`, [work_date, c.start, c.end]);

			// Approve one pending opening PT if slot free
			if (openingApproved.length === 0) {
				const { rows: pendingOpening } = await pool.query(`
					SELECT s.* 
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
						try {
							await syncRow("employee_schedule", updated[0], "employee_id,work_date");
						} catch (e) {
							console.warn("syncRow warning:", e?.message || e);
						}
						console.log(`✅ Approved PT opening: schedule_id=${updated[0].schedule_id} date=${work_date}`);
					}
				}
			}

			// Approve one pending closing PT if slot free
			if (closingApproved.length === 0) {
				const { rows: pendingClosing } = await pool.query(`
					SELECT s.* 
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
						try {
							await syncRow("employee_schedule", updated[0], "employee_id,work_date");
						} catch (e) {
							console.warn("syncRow warning:", e?.message || e);
						}
						console.log(`✅ Approved PT closing: schedule_id=${updated[0].schedule_id} date=${work_date}`);
					}
				}
			}

			// Reject leftover pending PT requests for this date (select then update & sync)
			const { rows: leftoverPending } = await pool.query(`
				SELECT s.*
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
					try {
						await syncRow("employee_schedule", updated[0], "employee_id,work_date");
					} catch (e) {
						console.warn("syncRow warning:", e?.message || e);
					}
					console.log(`❌ Rejected PT (leftover): schedule_id=${updated[0].schedule_id} date=${work_date}`);
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
cron.schedule("0 0 3 * * 0", async () => {
	try {
		console.log("🧹 Cleaning old schedules...");
		// select rows to delete so we can sync deletions
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
					deleteRow("employee_schedule", "schedule_id", r.schedule_id);
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
