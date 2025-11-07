// scheduleController.js
import { syncRow, deleteRow } from '../utils/syncToSupabase.js';
import { getIo } from "../socket.js";

export function scheduleController(pool) {

    const getSchedule = async (req, reply) => {
        const { start, end } = req.query;

        try {
            if (!start || !end) {
                return reply.status(400).send({ 
                    success: false, 
                    message: "start and end date parameters are required" 
                });
            }

            console.log(`🔍 Query parameters - Start: ${start}, End: ${end}`);

            // Fetch ALL employees
            const employeesResult = await pool.query(`
                SELECT 
                    employee_id, 
                    fullname, 
                    employment_type
                FROM employees
                WHERE status IN ('Employed', 'Probationary')
                ORDER BY fullname
            `);

            console.log(`✅ Fetched ${employeesResult.rows.length} employees`);

            // Fetch ALL schedules within date range - convert work_date to string format
            const schedulesResult = await pool.query(`
                SELECT 
                    s.schedule_id, 
                    s.employee_id, 
                    TO_CHAR(s.work_date, 'YYYY-MM-DD') as work_date,
                    s.start_time::text as start_time,
                    s.end_time::text as end_time, 
                    s.task, 
                    s.status,
                    s.work_location
                FROM employee_schedule s
                WHERE s.work_date BETWEEN $1::date AND $2::date
                ORDER BY s.employee_id, s.work_date, s.start_time
            `, [start, end]);

            console.log(`✅ Fetched ${schedulesResult.rows.length} schedules for ${start} to ${end}`);
            
            if (schedulesResult.rows.length > 0) {
                console.log('Sample schedules:');
                schedulesResult.rows.slice(0, 3).forEach((schedule, idx) => {
                    console.log(`  [${idx}]`, {
                        employee_id: schedule.employee_id,
                        work_date: schedule.work_date,
                        start_time: schedule.start_time,
                        end_time: schedule.end_time
                    });
                });
            }

            return reply.send({ 
                success: true, 
                data: {
                    employees: employeesResult.rows,
                    schedules: schedulesResult.rows
                }
            });
        } catch (err) {
            console.error("❌ Error fetching schedule:", err);
            return reply.status(500).send({ success: false, message: "Failed to fetch schedule" });
        }
    };

    return {
        getSchedule
    };
}