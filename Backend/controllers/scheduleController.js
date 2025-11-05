import { syncRow, deleteRow } from '../utils/syncToSupabase.js';
import { getIo } from "../socket.js";

export function scheduleController(pool) {

    const getSchedule = async (req, reply) => {
        const { start, end } = req.query;

        try {
            const { rows } = await pool.query(`
                SELECT s.*, e.fullname, e.employment_type
                FROM employee_schedule s
                JOIN employees e ON e.employee_id = s.employee_id
                WHERE s.work_date BETWEEN $1 AND $2
                ORDER BY s.work_date, s.start_time
            `, [start, end]);

            return reply.send({ success: true, data: rows });
        } catch (err) {
            console.error("Error fetching schedule:", err);
            return reply.status(500).send({ success: false, message: "Failed to fetch schedule" });
        }
    };

    // POST - Add new schedule
    const addSchedule = async (req, reply) => {
        const { employee_id, work_date, start_time, end_time, task, status } = req.body;
        const io = getIo();

        try {
            const { rows } = await pool.query(`
                INSERT INTO employee_schedule 
                (employee_id, work_date, start_time, end_time, task, status, created_at, updated_at)
                VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())
                RETURNING *
            `, [employee_id, work_date, start_time, end_time, task || 'Regular Shift', status || 'approved']);

            const newSchedule = rows[0];

            reply.send({ success: true, data: newSchedule });

            setImmediate(async () => {
                await syncRow('employee_schedule', newSchedule, 'schedule_id');
                io.to(`employee_${employee_id}`).emit('scheduleUpdated', newSchedule);
                io.emit('adminScheduleUpdated', newSchedule);
            });
        } catch (err) {
            console.error("Error adding schedule:", err);
            if (err.code === '23505') {
                return reply.status(400).send({ success: false, message: "This employee already has a schedule for this date" });
            }
            return reply.status(500).send({ success: false, message: "Failed to add schedule" });
        }
    };

    // PUT - Update schedule
    const updateSchedule = async (req, reply) => {
        const { id } = req.params;
        const { start_time, end_time, task, status } = req.body;
        const io = getIo();

        try {
            const { rows } = await pool.query(`
                UPDATE employee_schedule
                SET start_time = COALESCE($1, start_time),
                    end_time = COALESCE($2, end_time),
                    task = COALESCE($3, task),
                    status = COALESCE($4, status),
                    updated_at = NOW()
                WHERE schedule_id = $5
                RETURNING *
            `, [start_time, end_time, task, status, id]);

            if (rows.length === 0) {
                return reply.status(404).send({ success: false, message: "Schedule not found" });
            }

            const updated = rows[0];

            reply.send({ success: true, data: updated})
            
            setImmediate=(async () => {
                await syncRow('employee_schedule', updated, 'schedule_id');
                io.to(`employee_${updated.employee_id}`).emit('scheduleUpdated', updated);
                io.emit('adminScheduleUpdated', updated);
            })
        } catch (err) {
            console.error("Error updating schedule:", err);
            return reply.status(500).send({ success: false, message: "Failed to update schedule" });
        }
    };

    // DELETE - Remove schedule
    const deleteSchedule = async (req, reply) => {
        const { id } = req.params;
        const io = getIo();

        try {
            const { rows } = await pool.query(`
                DELETE FROM employee_schedule
                WHERE schedule_id = $1
                RETURNING *
            `, [id]);

            if (rows.length === 0) {
                return reply.status(404).send({ success: false, message: "Schedule not found" });
            }

            const deleted = rows[0];

            reply.send({ success: true, message: "Schedule deleted successfully."})

            setImmediate(async () => {
                await deleteRow('employee_schedule', 'schedule_id', id);
                io.to(`employee_${deleted.employee_id}`).emit('scheduleDeleted', { schedule_id: id });
                io.emit('adminScheduleDeleted', { schedule_id: id });
            })
        } catch (err) {
            console.error("Error deleting schedule:", err);
            return reply.status(500).send({ success: false, message: "Failed to delete schedule" });
        }
    };

    // POST - Publish all schedules for a week
    const publishSchedules = async (req, reply) => {
        const { start_date, end_date } = req.body;
        const io = getIo();

        try {
            const { rows } = await pool.query(`
                UPDATE employee_schedule
                SET status = 'approved', updated_at = NOW()
                WHERE work_date BETWEEN $1 AND $2
                  AND status = 'pending'
                RETURNING *
            `, [start_date, end_date]);

            reply.send({ 
                success: true, 
                message: `Published ${rows.length} schedules`,
                data: rows 
            });

            setImmediate=(async () => {
                for (const schedule of rows) {
                    await syncRow('employee_schedule', schedule, 'schedule_id');
                    io.to(`employee_${schedule.employee_id}`).emit('scheduleApproved', schedule);
                }
                io.emit('schedulesPublished', { count: rows.length, dates: [start_date, end_date] });
            })
        } catch (err) {
            console.error("Error publishing schedules:", err);
            return reply.status(500).send({ success: false, message: "Failed to publish schedules" });
        }
    };

    return {
        getSchedule,
        addSchedule,
        updateSchedule,
        deleteSchedule,
        publishSchedules
    };
}