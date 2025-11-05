import { syncRow, deleteRow } from '../utils/syncToSupabase.js';
import { getIo } from "../socket.js";
import { sendNotification } from '../utils/notificationHelper.js';

export function incidentController(pool) {

    // GET - Fetch all incident reports
    const getAllIncidents = async (req, reply) => {
        try {
            const { rows } = await pool.query(`
                SELECT i.*, e.fullname as employee_name
                FROM incident_reports i
                LEFT JOIN employees e ON i.employee_id = e.employee_id
                ORDER BY i.incident_date DESC, i.incident_id DESC
            `);

            return reply.send({ success: true, data: rows });
        } catch (err) {
            console.error("Error fetching incidents:", err);
            return reply.status(500).send({ success: false, message: "Failed to fetch incidents" });
        }
    };

    // GET - Fetch incidents for specific employee
    const getEmployeeIncidents = async (req, reply) => {
        const { id } = req.params;

        try {
            const { rows } = await pool.query(`
                SELECT i.*, e.fullname as employee_name
                FROM incident_reports i
                LEFT JOIN employees e ON i.employee_id = e.employee_id
                WHERE i.employee_id = $1
                ORDER BY i.incident_date DESC
            `, [id]);

            return reply.send({ success: true, data: rows });
        } catch (err) {
            console.error("Error fetching employee incidents:", err);
            return reply.status(500).send({ success: false, message: "Failed to fetch incidents" });
        }
    };

    // GET - Fetch single incident by ID
    const getIncidentById = async (req, reply) => {
        const { id } = req.params;

        try {
            const { rows } = await pool.query(`
                SELECT i.*, e.fullname as employee_name, e.email
                FROM incident_reports i
                LEFT JOIN employees e ON i.employee_id = e.employee_id
                WHERE i.incident_id = $1
            `, [id]);

            if (rows.length === 0) {
                return reply.status(404).send({ success: false, message: "Incident not found" });
            }

            return reply.send({ success: true, data: rows[0] });
        } catch (err) {
            console.error("Error fetching incident:", err);
            return reply.status(500).send({ success: false, message: "Failed to fetch incident" });
        }
    };

    // POST - Create new incident report
    const createIncident = async (req, reply) => {
        const { 
            employee_id, 
            incident_type, 
            incident_date, 
            witness, 
            reported_by, 
            description 
        } = req.body;

        const io = getIo();

        if (!incident_type || !incident_date || !description) {
            return reply.status(400).send({ 
                success: false, 
                message: "Incident type, date, and description are required" 
            });
        }

        try {
            const { rows } = await pool.query(`
                INSERT INTO incident_reports 
                (employee_id, incident_type, incident_date, witness, reported_by, description, status)
                VALUES ($1, $2, $3, $4, $5, $6, 'Pending')
                RETURNING *
            `, [employee_id, incident_type, incident_date, witness, reported_by, description]);

            const newIncident = rows[0];

            // Sync to Supabase
            await syncRow('incident_reports', newIncident, 'incident_id');

            // Send notification to employee if applicable
            if (employee_id) {
                const message = `A new incident report has been filed regarding you: ${incident_type}`;
                await sendNotification(pool, employee_id, 'incident', 'created', message);
            }

            // Emit real-time update
            io.emit('adminIncidentCreated', newIncident);
            if (employee_id) {
                io.to(`employee_${employee_id}`).emit('incidentCreated', newIncident);
            }

            return reply.send({ 
                success: true, 
                message: "Incident report created successfully",
                data: newIncident 
            });
        } catch (err) {
            console.error("Error creating incident:", err);
            return reply.status(500).send({ success: false, message: "Failed to create incident" });
        }
    };

    // PUT - Update incident report
    const updateIncident = async (req, reply) => {
        const { id } = req.params;
        const { 
            incident_type, 
            incident_date, 
            witness, 
            reported_by, 
            description, 
            status 
        } = req.body;

        const io = getIo();

        try {
            const { rows } = await pool.query(`
                UPDATE incident_reports
                SET incident_type = COALESCE($1, incident_type),
                    incident_date = COALESCE($2, incident_date),
                    witness = COALESCE($3, witness),
                    reported_by = COALESCE($4, reported_by),
                    description = COALESCE($5, description),
                    status = COALESCE($6, status)
                WHERE incident_id = $7
                RETURNING *
            `, [incident_type, incident_date, witness, reported_by, description, status, id]);

            if (rows.length === 0) {
                return reply.status(404).send({ success: false, message: "Incident not found" });
            }

            const updated = rows[0];

            // Sync to Supabase
            await syncRow('incident_reports', updated, 'incident_id');

            // Send notification if status changed
            if (status && updated.employee_id) {
                const message = `Your incident report status has been updated to: ${status}`;
                await sendNotification(pool, updated.employee_id, 'incident', 'updated', message);
            }

            // Emit real-time update
            io.emit('adminIncidentUpdated', updated);
            if (updated.employee_id) {
                io.to(`employee_${updated.employee_id}`).emit('incidentUpdated', updated);
            }

            return reply.send({ 
                success: true, 
                message: "Incident updated successfully",
                data: updated 
            });
        } catch (err) {
            console.error("Error updating incident:", err);
            return reply.status(500).send({ success: false, message: "Failed to update incident" });
        }
    };

    // DELETE - Delete incident report
    const deleteIncident = async (req, reply) => {
        const { id } = req.params;
        const io = getIo();

        try {
            const { rows } = await pool.query(`
                DELETE FROM incident_reports
                WHERE incident_id = $1
                RETURNING *
            `, [id]);

            if (rows.length === 0) {
                return reply.status(404).send({ success: false, message: "Incident not found" });
            }

            const deleted = rows[0];

            reply.send({ success: true, message: "Incident deleted successfully" });
            
            setImmediate=(async () => {
                await deleteRow('incident_reports', 'incident_id', id);
                io.emit('adminIncidentDeleted', { incident_id: id });
                if (deleted.employee_id) {
                    io.to(`employee_${deleted.employee_id}`).emit('incidentDeleted', { incident_id: id });
                }
            })
        } catch (err) {
            console.error("Error deleting incident:", err);
            return reply.status(500).send({ success: false, message: "Failed to delete incident" });
        }
    };

    return {
        getAllIncidents,
        getEmployeeIncidents,
        getIncidentById,
        createIncident,
        updateIncident,
        deleteIncident
    };
}
