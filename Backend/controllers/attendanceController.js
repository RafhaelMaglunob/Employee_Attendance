export function attendanceController(pool) {

    const getAllAttendance = async (req, reply) => {
        try {
            const result = await pool.query(`
                SELECT 
                    a.attendance_id,
                    a.employee_id,
                    e.fullname AS employee_name,
                    TO_CHAR(a.clock_in, 'HH12:MI AM') AS clock_in,
                    TO_CHAR(a.clock_out, 'HH12:MI AM') AS clock_out,
                    a.total_hours,
                    a.status
                FROM employee_attendance a
                JOIN employees e ON a.employee_id = e.employee_id
                ORDER BY a.attendance_id ASC;
            `);

            return { success: true, data: result.rows };
        } catch (err) {
            console.error("Database Error:", err.message);
            reply.status(500).send({ error: "Failed to fetch attendance.", details: err.message });
        }
    };

    return {
        getAllAttendance,
    };
}
