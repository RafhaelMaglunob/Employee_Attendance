import { syncRow } from '../utils/syncToSupabase.js';
import { getIo } from "../socket.js";

export function employeeDashboardController(pool) {

    // Get employee schedule for a specific date range
    const getEmployeeSchedule = async (req, reply) => {
        const { employeeId } = req.params;
        
        try {
            const result = await pool.query(`
                SELECT 
                    schedule_id,
                    employee_id,
                    work_date,
                    start_time,
                    end_time,
                    task,
                    created_at
                FROM employee_schedules
                WHERE employee_id = $1
                ORDER BY work_date ASC
            `, [employeeId]);

            return reply.send(result.rows);
        } catch (err) {
            console.error("❌ Error fetching employee schedule:", err.message);
            return reply.status(500).send({ error: "Failed to fetch schedule" });
        }
    };

    // Get today's time logs for an employee
    const getEmployeeTimeLogs = async (req, reply) => {
        const { employeeId } = req.params;
        
        try {
            const today = new Date().toISOString().split('T')[0];
            
            const result = await pool.query(`
                SELECT 
                    clock_in,
                    break_start,
                    break_end,
                    clock_out
                FROM employee_attendance
                WHERE employee_id = $1 AND date = $2
                ORDER BY date DESC
                LIMIT 1
            `, [employeeId, today]);

            if (result.rows.length === 0) {
                return reply.send({
                    clock_in: null,
                    break_start: null,
                    break_end: null,
                    clock_out: null
                });
            }

            return reply.send(result.rows[0]);
        } catch (err) {
            console.error("❌ Error fetching time logs:", err.message);
            return reply.status(500).send({ error: "Failed to fetch time logs" });
        }
    };

    // Get weekly summary (hours worked)
    const getWeeklySummary = async (req, reply) => {
        const { employeeId } = req.params;
        
        try {
            // Get current week's Monday and Sunday
            const today = new Date();
            const dayOfWeek = today.getDay();
            const diff = dayOfWeek === 0 ? -6 : 1 - dayOfWeek; // Monday = 1
            const monday = new Date(today);
            monday.setDate(today.getDate() + diff);
            monday.setHours(0, 0, 0, 0);
            
            const sunday = new Date(monday);
            sunday.setDate(monday.getDate() + 6);
            sunday.setHours(23, 59, 59, 999);

            const mondayStr = monday.toISOString().split('T')[0];
            const sundayStr = sunday.toISOString().split('T')[0];

            const result = await pool.query(`
                SELECT 
                    COALESCE(SUM(
                        EXTRACT(EPOCH FROM (clock_out - clock_in)) / 3600 -
                        EXTRACT(EPOCH FROM (break_end - break_start)) / 3600
                    ), 0) as hours_worked
                FROM employee_attendance
                WHERE employee_id = $1 
                AND date BETWEEN $2 AND $3
                AND clock_in IS NOT NULL 
                AND clock_out IS NOT NULL
            `, [employeeId, mondayStr, sundayStr]);

            const hoursWorked = Math.round(result.rows[0]?.hours_worked || 0);

            return reply.send({ hours_worked: hoursWorked });
        } catch (err) {
            console.error("❌ Error fetching weekly summary:", err.message);
            return reply.status(500).send({ error: "Failed to fetch weekly summary" });
        }
    };

    // Clock in/out endpoints with socket support
    const clockIn = async (req, reply) => {
        const { employeeId } = req.body;
        const io = getIo();
        
        try {
            const today = new Date().toISOString().split('T')[0];
            const now = new Date().toTimeString().split(' ')[0];

            const result = await pool.query(`
                INSERT INTO employee_attendance (employee_id, date, clock_in)
                VALUES ($1, $2, $3)
                ON CONFLICT (employee_id, date) 
                DO UPDATE SET clock_in = $3
                RETURNING *
            `, [employeeId, today, now]);

            const attendance = result.rows[0];

            // Send response first
            reply.send({ success: true, data: attendance });

            // Background operations
            setImmediate(async () => {
                // Sync to Supabase
                try {
                    await syncRow('employee_attendance', attendance, 'id');
                } catch (err) {
                    console.error("❌ Supabase sync error (employee_attendance):", err.message);
                }

                // Emit socket event
                io.emit('timeLogUpdated', { employee_id: parseInt(employeeId), type: 'clock_in' });
            });

        } catch (err) {
            console.error("❌ Clock in error:", err.message);
            return reply.status(500).send({ error: "Failed to clock in" });
        }
    };

    const clockOut = async (req, reply) => {
        const { employeeId } = req.body;
        const io = getIo();
        
        try {
            const today = new Date().toISOString().split('T')[0];
            const now = new Date().toTimeString().split(' ')[0];

            const result = await pool.query(`
                UPDATE employee_attendance 
                SET clock_out = $1
                WHERE employee_id = $2 AND date = $3
                RETURNING *
            `, [now, employeeId, today]);

            if (result.rows.length === 0) {
                return reply.status(400).send({ error: "No clock in record found" });
            }

            const attendance = result.rows[0];

            // Send response first
            reply.send({ success: true, data: attendance });

            // Background operations
            setImmediate(async () => {
                // Sync to Supabase
                try {
                    await syncRow('employee_attendance', attendance, 'id');
                } catch (err) {
                    console.error("❌ Supabase sync error (employee_attendance):", err.message);
                }

                // Emit socket event
                io.emit('timeLogUpdated', { employee_id: parseInt(employeeId), type: 'clock_out' });
            });

        } catch (err) {
            console.error("❌ Clock out error:", err.message);
            return reply.status(500).send({ error: "Failed to clock out" });
        }
    };

    const startBreak = async (req, reply) => {
        const { employeeId } = req.body;
        const io = getIo();
        
        try {
            const today = new Date().toISOString().split('T')[0];
            const now = new Date().toTimeString().split(' ')[0];

            const result = await pool.query(`
                UPDATE employee_attendance 
                SET break_start = $1
                WHERE employee_id = $2 AND date = $3
                RETURNING *
            `, [now, employeeId, today]);

            if (result.rows.length === 0) {
                return reply.status(400).send({ error: "No clock in record found" });
            }

            const attendance = result.rows[0];

            // Send response first
            reply.send({ success: true, data: attendance });

            // Background operations
            setImmediate(async () => {
                // Sync to Supabase
                try {
                    await syncRow('employee_attendance', attendance, 'id');
                } catch (err) {
                    console.error("❌ Supabase sync error (employee_attendance):", err.message);
                }

                // Emit socket event
                io.emit('timeLogUpdated', { employee_id: parseInt(employeeId), type: 'break_start' });
            });

        } catch (err) {
            console.error("❌ Start break error:", err.message);
            return reply.status(500).send({ error: "Failed to start break" });
        }
    };

    const endBreak = async (req, reply) => {
        const { employeeId } = req.body;
        const io = getIo();
        
        try {
            const today = new Date().toISOString().split('T')[0];
            const now = new Date().toTimeString().split(' ')[0];

            const result = await pool.query(`
                UPDATE employee_attendance 
                SET break_end = $1
                WHERE employee_id = $2 AND date = $3
                RETURNING *
            `, [now, employeeId, today]);

            if (result.rows.length === 0) {
                return reply.status(400).send({ error: "No clock in record found" });
            }

            const attendance = result.rows[0];

            // Send response first
            reply.send({ success: true, data: attendance });

            // Background operations
            setImmediate(async () => {
                // Sync to Supabase
                try {
                    await syncRow('employee_attendance', attendance, 'id');
                } catch (err) {
                    console.error("❌ Supabase sync error (employee_attendance):", err.message);
                }

                // Emit socket event
                io.emit('timeLogUpdated', { employee_id: parseInt(employeeId), type: 'break_end' });
            });

        } catch (err) {
            console.error("❌ End break error:", err.message);
            return reply.status(500).send({ error: "Failed to end break" });
        }
    };

    return {
        getEmployeeSchedule,
        getEmployeeTimeLogs,
        getWeeklySummary,
        clockIn,
        clockOut,
        startBreak,
        endBreak
    };
}
