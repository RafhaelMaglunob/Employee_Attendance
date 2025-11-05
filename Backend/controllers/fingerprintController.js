import { syncRow } from '../utils/syncToSupabase.js';

export function fingerprintController(pg) {
  
  // Get occupied fingerprint slots
  const getOccupiedSlots = async (req, reply) => {
    try {
      const result = await pg.query(
        'SELECT fingerprint_slot FROM employee_fingerprints WHERE status = $1',
        ['Active']
      );
      
      const slots = result.rows.map(row => row.fingerprint_slot);
      return reply.send({ slots });
    } catch (error) {
      console.error('Error fetching slots:', error);
      return reply.status(500).send({ error: 'Failed to fetch slots' });
    }
  };

  // Start fingerprint enrollment
  const startEnrollment = async (req, reply) => {
    const { employee_id, slot } = req.body;
    
    try {
      // Check if slot is already taken
      const existing = await pg.query(
        'SELECT * FROM employee_fingerprints WHERE fingerprint_slot = $1 AND status = $2',
        [slot, 'Active']
      );
      
      if (existing.rows.length > 0) {
        return reply.status(400).send({ error: 'Slot already occupied' });
      }
      
      // Check if employee exists
      const employee = await pg.query(
        'SELECT employee_id, fullname FROM employees WHERE employee_id = $1',
        [employee_id]
      );
      
      if (employee.rows.length === 0) {
        return reply.status(404).send({ error: 'Employee not found' });
      }
      
      // Get the global enrollmentStatus from the main server file
      const { enrollmentStatus, port } = req.server;
      
      // Initialize enrollment status
      Object.assign(enrollmentStatus, {
        slot,
        employee_id,
        status: 'enrolling',
        message: 'Initializing...'
      });
      
      // Send command to Arduino
      const command = `ENROLL:${employee_id}:${slot}\n`;
      
      port.write(command, (err) => {
        if (err) {
          console.error('Error writing to Arduino:', err);
          return reply.status(500).send({ error: 'Failed to communicate with device' });
        }
        
        console.log('Enrollment command sent:', command);
      });
      
      return reply.send({ 
        success: true, 
        message: 'Enrollment started',
        slot 
      });
      
    } catch (error) {
      console.error('Error starting enrollment:', error);
      return reply.status(500).send({ error: 'Failed to start enrollment' });
    }
  };

  // Get enrollment status
  const getEnrollmentStatus = async (req, reply) => {
    const { slot } = req.query;
    const { enrollmentStatus, pg } = req.server;
    
    try {
      if (enrollmentStatus.slot === parseInt(slot)) {
        const currentStatus = { ...enrollmentStatus };
        
        // If complete, save to database
        if (enrollmentStatus.status === 'complete' && !enrollmentStatus.saved) {
          try {
            const insertRes = await pg.query(
              `INSERT INTO employee_fingerprints (employee_id, fingerprint_slot, status)
               VALUES ($1, $2, $3)
               ON CONFLICT (employee_id, fingerprint_slot) 
               DO UPDATE SET status = $3, registered_at = CURRENT_TIMESTAMP
               RETURNING *`,
              [enrollmentStatus.employee_id, slot, 'Active']
            );

            const fingerprintRecord = insertRes.rows[0];
            
            // Mark as saved to prevent duplicate inserts
            enrollmentStatus.saved = true;
            
            console.log(`✅ Fingerprint registered: Employee ${enrollmentStatus.employee_id} -> Slot ${slot}`);
            
            // Background sync to Supabase
            setImmediate(async () => {
              try {
                await syncRow('employee_fingerprints', fingerprintRecord, 'fingerprint_id');
              } catch (err) {
                console.error("❌ Supabase sync error (employee_fingerprints):", err.message);
              }
            });
            
            // Clear status after a delay
            setTimeout(() => {
              Object.keys(enrollmentStatus).forEach(key => delete enrollmentStatus[key]);
            }, 2000);
            
          } catch (error) {
            console.error('Error saving to database:', error);
            enrollmentStatus.status = 'error';
            enrollmentStatus.message = 'Failed to save to database';
          }
        }
        
        return reply.send(currentStatus);
      } else {
        return reply.send({ status: 'idle', message: 'No enrollment in progress' });
      }
    } catch (error) {
      console.error('Error getting enrollment status:', error);
      return reply.status(500).send({ error: 'Failed to get status' });
    }
  };

  // Handle attendance clock from Arduino
  const handleAttendanceClock = async (req, reply) => {
    const { fingerprint_id, timestamp } = req.body;
    
    try {
      // Get employee by fingerprint slot
      const fingerprintData = await pg.query(
        `SELECT ef.employee_id, e.fullname 
         FROM employee_fingerprints ef
         JOIN employees e ON ef.employee_id = e.employee_id
         WHERE ef.fingerprint_slot = $1 AND ef.status = $2`,
        [fingerprint_id, 'Active']
      );
      
      if (fingerprintData.rows.length === 0) {
        return reply.status(404).send({ error: 'Fingerprint not registered' });
      }
      
      const { employee_id, fullname } = fingerprintData.rows[0];
      const currentTime = new Date();
      const currentDate = currentTime.toISOString().split('T')[0];
      
      // Check today's attendance
      const todayAttendance = await pg.query(
        `SELECT * FROM employee_attendance 
         WHERE employee_id = $1 AND attend_date = $2`,
        [employee_id, currentDate]
      );
      
      let action, logRecord, attendanceRecord;

      if (todayAttendance.rows.length === 0) {
        // Clock IN
        const clockInTime = currentTime.toTimeString().split(' ')[0];
        
        const attendanceRes = await pg.query(
          `INSERT INTO employee_attendance 
           (employee_id, attend_date, clock_in, clock_out, total_hours, status)
           VALUES ($1, $2, $3, '00:00:00', 0, 'Pending')
           RETURNING *`,
          [employee_id, currentDate, clockInTime]
        );
        attendanceRecord = attendanceRes.rows[0];

        const logRes = await pg.query(
          `INSERT INTO fingerprint_attendance_log 
           (employee_id, fingerprint_slot, clock_type, clock_time)
           VALUES ($1, $2, $3, $4)
           RETURNING *`,
          [employee_id, fingerprint_id, 'IN', currentTime]
        );
        logRecord = logRes.rows[0];
        
        action = 'CLOCK_IN';
        
        reply.send({ 
          success: true, 
          action: 'CLOCK_IN',
          employee: fullname,
          time: currentTime
        });

      } else {
        // Clock OUT
        const clockInTime = todayAttendance.rows[0].clock_in;
        const clockOutTime = currentTime.toTimeString().split(' ')[0];
        
        // Calculate hours
        const clockInDate = new Date(`${currentDate}T${clockInTime}`);
        const clockOutDate = new Date(currentTime);
        const hours = ((clockOutDate - clockInDate) / (1000 * 60 * 60)).toFixed(2);
        
        const attendanceRes = await pg.query(
          `UPDATE employee_attendance 
           SET clock_out = $1, total_hours = $2, status = $3
           WHERE employee_id = $4 AND attend_date = $5
           RETURNING *`,
          [clockOutTime, hours, 'Present', employee_id, currentDate]
        );
        attendanceRecord = attendanceRes.rows[0];

        const logRes = await pg.query(
          `INSERT INTO fingerprint_attendance_log 
           (employee_id, fingerprint_slot, clock_type, clock_time)
           VALUES ($1, $2, $3, $4)
           RETURNING *`,
          [employee_id, fingerprint_id, 'OUT', currentTime]
        );
        logRecord = logRes.rows[0];
        
        action = 'CLOCK_OUT';
        
        reply.send({ 
          success: true, 
          action: 'CLOCK_OUT',
          employee: fullname,
          time: currentTime,
          total_hours: hours
        });
      }
      
      // Update last used
      const updateRes = await pg.query(
        `UPDATE employee_fingerprints 
         SET last_used = CURRENT_TIMESTAMP 
         WHERE fingerprint_slot = $1
         RETURNING *`,
        [fingerprint_id]
      );
      const updatedFingerprint = updateRes.rows[0];

      // Background sync to Supabase
      setImmediate(async () => {
        try {
          await syncRow('fingerprint_attendance_log', logRecord, 'log_id');
        } catch (err) {
          console.error("❌ Supabase sync error (fingerprint_attendance_log):", err.message);
        }

        try {
          await syncRow('employee_attendance', attendanceRecord, 'attendance_id');
        } catch (err) {
          console.error("❌ Supabase sync error (employee_attendance):", err.message);
        }

        try {
          await syncRow('employee_fingerprints', updatedFingerprint, 'fingerprint_id');
        } catch (err) {
          console.error("❌ Supabase sync error (employee_fingerprints):", err.message);
        }
      });
      
    } catch (error) {
      console.error('Error processing attendance:', error);
      return reply.status(500).send({ error: 'Failed to process attendance' });
    }
  };

  // Delete fingerprint registration
  const deleteFingerprint = async (req, reply) => {
    const { slot } = req.params;
    
    try {
      const updateRes = await pg.query(
        'UPDATE employee_fingerprints SET status = $1 WHERE fingerprint_slot = $2 RETURNING *',
        ['Deleted', slot]
      );

      if (updateRes.rows.length === 0) {
        return reply.status(404).send({ error: 'Fingerprint not found' });
      }

      const deletedFingerprint = updateRes.rows[0];
      
      reply.send({ success: true, message: 'Fingerprint deleted' });

      // Background sync to Supabase
      setImmediate(async () => {
        try {
          await syncRow('employee_fingerprints', deletedFingerprint, 'fingerprint_id');
        } catch (err) {
          console.error("❌ Supabase sync error (employee_fingerprints):", err.message);
        }
      });

    } catch (error) {
      console.error('Error deleting fingerprint:', error);
      return reply.status(500).send({ error: 'Failed to delete fingerprint' });
    }
  };

  // Get employee fingerprints
  const getEmployeeFingerprints = async (req, reply) => {
    const { employee_id } = req.params;
    
    try {
      const result = await pg.query(
        `SELECT 
          fingerprint_id,
          employee_id,
          fingerprint_slot,
          TO_CHAR(registered_at, 'MM/DD/YYYY HH24:MI:SS') as registered_at,
          TO_CHAR(last_used, 'MM/DD/YYYY HH24:MI:SS') as last_used,
          status
         FROM employee_fingerprints 
         WHERE employee_id = $1 AND status = $2
         ORDER BY registered_at DESC`,
        [employee_id, 'Active']
      );
      
      return reply.send({ success: true, fingerprints: result.rows });
    } catch (error) {
      console.error('Error fetching fingerprints:', error);
      return reply.status(500).send({ error: 'Failed to fetch fingerprints' });
    }
  };

  // Get all fingerprints (for admin)
  const getAllFingerprints = async (req, reply) => {
    try {
      const result = await pg.query(
        `SELECT 
          ef.fingerprint_id,
          ef.employee_id,
          e.fullname as employee_name,
          e.position,
          ef.fingerprint_slot,
          TO_CHAR(ef.registered_at, 'MM/DD/YYYY HH24:MI:SS') as registered_at,
          TO_CHAR(ef.last_used, 'MM/DD/YYYY HH24:MI:SS') as last_used,
          ef.status
         FROM employee_fingerprints ef
         JOIN employees e ON ef.employee_id = e.employee_id
         WHERE ef.status = $1
         ORDER BY ef.registered_at DESC`,
        ['Active']
      );
      
      return reply.send({ success: true, data: result.rows });
    } catch (error) {
      console.error('Error fetching all fingerprints:', error);
      return reply.status(500).send({ error: 'Failed to fetch fingerprints' });
    }
  };

  // Get fingerprint attendance logs
  const getFingerprintLogs = async (req, reply) => {
    const { employee_id, date } = req.query;
    
    try {
      let query = `
        SELECT 
          fal.log_id,
          fal.employee_id,
          e.fullname as employee_name,
          fal.fingerprint_slot,
          fal.clock_type,
          TO_CHAR(fal.clock_time, 'MM/DD/YYYY HH24:MI:SS') as clock_time,
          fal.confidence_score
        FROM fingerprint_attendance_log fal
        JOIN employees e ON fal.employee_id = e.employee_id
        WHERE 1=1
      `;
      
      const params = [];
      
      if (employee_id) {
        params.push(employee_id);
        query += ` AND fal.employee_id = $${params.length}`;
      }
      
      if (date) {
        params.push(date);
        query += ` AND DATE(fal.clock_time) = $${params.length}`;
      }
      
      query += ` ORDER BY fal.clock_time DESC LIMIT 100`;
      
      const result = await pg.query(query, params);
      
      return reply.send({ success: true, logs: result.rows });
    } catch (error) {
      console.error('Error fetching fingerprint logs:', error);
      return reply.status(500).send({ error: 'Failed to fetch logs' });
    }
  };

  return {
    getOccupiedSlots,
    startEnrollment,
    getEnrollmentStatus,
    handleAttendanceClock,
    deleteFingerprint,
    getEmployeeFingerprints,
    getAllFingerprints,
    getFingerprintLogs
  };
}