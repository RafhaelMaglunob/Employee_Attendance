import { syncRow } from '../utils/syncToSupabase.js';

export function fingerprintController(pg) {
  
  // Get occupied fingerprint slots
  const getOccupiedSlots = async (req, reply) => {
    try {
      const result = await pg.query(
        `SELECT fingerprint_slot FROM employee_fingerprints 
         WHERE status != $1 OR status IS NULL`,
        ['Deleted']
      );
      
      const slots = result.rows.map(row => row.fingerprint_slot);
      console.log('📍 Occupied slots:', slots);
      return reply.send({ slots });
    } catch (error) {
      console.error('Error fetching slots:', error);
      return reply.status(500).send({ error: 'Failed to fetch slots' });
    }
  };

  // ✅ NEW: Check if employee already has a fingerprint registered
  const checkEmployeeFingerprint = async (employee_id) => {
    const result = await pg.query(
      `SELECT ef.fingerprint_slot, ef.fingerprint_id 
       FROM employee_fingerprints ef
       WHERE ef.employee_id = $1 AND ef.status = $2`,
      [employee_id, 'Active']
    );
    return result.rows.length > 0 ? result.rows[0] : null;
  };

  // Start fingerprint enrollment
  const startEnrollment = async (req, reply) => {
    const { employee_id, slot } = req.body;
    
    console.log('🚀 Starting enrollment:', { employee_id, slot });
    
    try {
      // Validate slot number
      if (!slot || slot < 1 || slot > 127) {
        return reply.status(400).send({ error: 'Invalid slot number. Must be between 1-127' });
      }

      // ✅ CHECK: Does employee already have a fingerprint?
      const existingFingerprint = await checkEmployeeFingerprint(employee_id);
      if (existingFingerprint) {
        console.log('❌ Employee already has fingerprint:', existingFingerprint);
        return reply.status(400).send({ 
          error: `This employee already has a fingerprint registered in slot ${existingFingerprint.fingerprint_slot}`,
          existing: existingFingerprint
        });
      }

      // Check if slot is already taken
      const existing = await pg.query(
        `SELECT ef.*, e.fullname 
         FROM employee_fingerprints ef
         LEFT JOIN employees e ON ef.employee_id = e.employee_id
         WHERE ef.fingerprint_slot = $1 AND (ef.status != $2 OR ef.status IS NULL)`,
        [slot, 'Deleted']
      );
      
      if (existing.rows.length > 0) {
        const occupied = existing.rows[0];
        console.log('❌ Slot already occupied:', {
          slot,
          by: occupied.employee_id,
          name: occupied.fullname,
          status: occupied.status
        });
        return reply.status(400).send({ 
          error: `Slot ${slot} is already occupied by ${occupied.fullname || occupied.employee_id}`,
          occupied_by: {
            employee_id: occupied.employee_id,
            fullname: occupied.fullname,
            status: occupied.status
          }
        });
      }
      
      // Check if employee exists
      const employee = await pg.query(
        'SELECT employee_id, fullname FROM employees WHERE employee_id = $1',
        [employee_id]
      );
      
      if (employee.rows.length === 0) {
        console.log('❌ Employee not found:', employee_id);
        return reply.status(404).send({ error: 'Employee not found' });
      }
      
      const { enrollmentStatus, port } = req.server;
      
      // Initialize enrollment status
      Object.assign(enrollmentStatus, {
        slot,
        employee_id,
        status: 'enrolling',
        message: 'Waiting for device...',
        saved: false
      });
      
      console.log('📝 Enrollment status initialized:', enrollmentStatus);
      
      // Send command to Arduino
      const command = `ENROLL:${employee_id}:${slot}\n`;
      
      port.write(command, (err) => {
        if (err) {
          console.error('❌ Error writing to Arduino:', err);
          return reply.status(500).send({ error: 'Failed to communicate with device' });
        }
        
        console.log('✅ Enrollment command sent to Arduino:', command);
      });
      
      return reply.send({ 
        success: true, 
        message: 'Enrollment started',
        slot 
      });
      
    } catch (error) {
      console.error('❌ Error starting enrollment:', error);
      return reply.status(500).send({ error: 'Failed to start enrollment' });
    }
  };

  // Get enrollment status
  const getEnrollmentStatus = async (req, reply) => {
    const { slot } = req.query;
    const { enrollmentStatus, pg } = req.server;
    
    console.log('📊 Checking enrollment status for slot:', slot);
    console.log('📊 Current enrollmentStatus:', JSON.stringify(enrollmentStatus));
    
    try {
      if (enrollmentStatus.slot === parseInt(slot)) {
        const currentStatus = { ...enrollmentStatus };
        
        // If complete, save to database
        if (enrollmentStatus.status === 'complete' && !enrollmentStatus.saved) {
          try {
            const insertRes = await pg.query(
              `INSERT INTO employee_fingerprints (employee_id, fingerprint_slot, status, enrollment_type)
               VALUES ($1, $2, $3, $4)
               ON CONFLICT (employee_id, fingerprint_slot) 
               DO UPDATE SET status = $3, registered_at = CURRENT_TIMESTAMP
               RETURNING *`,
              [enrollmentStatus.employee_id, slot, 'Active', 'hardware']
            );

            const fingerprintRecord = insertRes.rows[0];
            
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
            
            setTimeout(() => {
              Object.keys(enrollmentStatus).forEach(key => delete enrollmentStatus[key]);
              console.log('🧹 Enrollment status cleared');
            }, 2000);
            
          } catch (error) {
            console.error('❌ Error saving to database:', error);
            enrollmentStatus.status = 'error';
            enrollmentStatus.message = 'Failed to save to database';
          }
        }
        
        return reply.send(currentStatus);
      } else {
        return reply.send({ status: 'idle', message: 'No enrollment in progress' });
      }
    } catch (error) {
      console.error('❌ Error getting enrollment status:', error);
      return reply.status(500).send({ error: 'Failed to get status' });
    }
  };

  const handleAttendanceClock = async (req, reply) => {
    const { fingerprint_id, timestamp } = req.body;
    
    try {
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
      
      const todayAttendance = await pg.query(
        `SELECT * FROM employee_attendance 
         WHERE employee_id = $1 AND attend_date = $2`,
        [employee_id, currentDate]
      );
      
      let action, logRecord, attendanceRecord;

      if (todayAttendance.rows.length === 0) {
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
        const clockInTime = todayAttendance.rows[0].clock_in;
        const clockOutTime = currentTime.toTimeString().split(' ')[0];
        
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
      
      const updateRes = await pg.query(
        `UPDATE employee_fingerprints 
         SET last_used = CURRENT_TIMESTAMP 
         WHERE fingerprint_slot = $1
         RETURNING *`,
        [fingerprint_id]
      );
      const updatedFingerprint = updateRes.rows[0];

      setImmediate(async () => {
        try {
          await syncRow('fingerprint_attendance_log', logRecord, 'log_id');
          await syncRow('employee_attendance', attendanceRecord, 'attendance_id');
          await syncRow('employee_fingerprints', updatedFingerprint, 'fingerprint_id');
        } catch (err) {
          console.error("❌ Supabase sync error:", err.message);
        }
      });
      
    } catch (error) {
      console.error('❌ Error processing attendance:', error);
      return reply.status(500).send({ error: 'Failed to process attendance' });
    }
  };

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

      setImmediate(async () => {
        try {
          await syncRow('employee_fingerprints', deletedFingerprint, 'fingerprint_id');
        } catch (err) {
          console.error("❌ Supabase sync error:", err.message);
        }
      });

    } catch (error) {
      console.error('❌ Error deleting fingerprint:', error);
      return reply.status(500).send({ error: 'Failed to delete fingerprint' });
    }
  };

  const getEmployeeFingerprints = async (req, reply) => {
    const { employee_id } = req.params;
    
    console.log('🔍 Fetching fingerprints for employee:', employee_id);
    
    try {
      const result = await pg.query(
        `SELECT 
          fingerprint_id,
          employee_id,
          fingerprint_slot,
          enrollment_type,
          TO_CHAR(registered_at, 'MM/DD/YYYY HH24:MI:SS') as registered_at,
          TO_CHAR(last_used, 'MM/DD/YYYY HH24:MI:SS') as last_used,
          status
         FROM employee_fingerprints 
         WHERE employee_id = $1 AND status = $2
         ORDER BY registered_at DESC`,
        [employee_id, 'Active']
      );
      
      console.log(`✅ Found ${result.rows.length} fingerprints for employee ${employee_id}`);
      
      return reply.send({ success: true, fingerprints: result.rows });
    } catch (error) {
      console.error('❌ Error fetching fingerprints:', error);
      return reply.status(500).send({ error: 'Failed to fetch fingerprints' });
    }
  };

  const getAllFingerprints = async (req, reply) => {
    try {
      const result = await pg.query(
        `SELECT 
          ef.fingerprint_id,
          ef.employee_id,
          e.fullname as employee_name,
          e.position,
          ef.fingerprint_slot,
          ef.enrollment_type,
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
      console.error('❌ Error fetching all fingerprints:', error);
      return reply.status(500).send({ error: 'Failed to fetch fingerprints' });
    }
  };

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
      console.error('❌ Error fetching fingerprint logs:', error);
      return reply.status(500).send({ error: 'Failed to fetch logs' });
    }
  };

  const getEmployeesWithFingerprintStatus = async (req, reply) => {
    try {
      console.log('🔍 Fetching employees with fingerprint status...');
      
      const result = await pg.query(
        `SELECT 
          e.employee_id,
          e.fullname,
          e.position,
          e.employment_type,
          e.status as employee_status,
          ef.fingerprint_slot,
          ef.enrollment_type,
          TO_CHAR(ef.registered_at, 'MM/DD/YYYY HH24:MI:SS') as registered_at,
          TO_CHAR(ef.last_used, 'MM/DD/YYYY HH24:MI:SS') as last_used,
          CASE 
            WHEN ef.fingerprint_id IS NOT NULL AND ef.status = 'Active' THEN true 
            ELSE false 
          END as fingerprint_registered
        FROM employees e
        LEFT JOIN employee_fingerprints ef 
          ON e.employee_id = ef.employee_id 
          AND ef.status = 'Active'
        WHERE e.status = 'Employed'
        ORDER BY e.fullname ASC`
      );
      
      console.log(`✅ Found ${result.rows.length} employees`);
      console.log(`📊 With fingerprints: ${result.rows.filter(r => r.fingerprint_registered).length}`);
      
      return reply.send({ 
        success: true, 
        employees: result.rows,
        total: result.rows.length,
        registered: result.rows.filter(r => r.fingerprint_registered).length
      });
    } catch (error) {
      console.error('❌ Error fetching employees with fingerprint status:', error);
      return reply.status(500).send({ 
        success: false,
        error: 'Failed to fetch employees',
        details: error.message 
      });
    }
  };

  const validateHardwareFingerprint = async (req, reply) => {
    const { slot } = req.params;
    const { port } = req.server;
    
    console.log('🔍 Validating hardware fingerprint for slot:', slot);
    
    try {
      const dbCheck = await pg.query(
        `SELECT ef.*, e.fullname 
         FROM employee_fingerprints ef
         JOIN employees e ON ef.employee_id = e.employee_id
         WHERE ef.fingerprint_slot = $1 AND ef.status = $2`,
        [slot, 'Active']
      );
      
      const existsInDB = dbCheck.rows.length > 0;
      const dbData = existsInDB ? dbCheck.rows[0] : null;
      
      return new Promise((resolve) => {
        const command = `VALIDATE:${slot}\n`;
        let responseReceived = false;
        
        const timeout = setTimeout(() => {
          if (!responseReceived) {
            resolve(reply.send({
              success: false,
              slot: parseInt(slot),
              existsInDB,
              existsInHardware: false,
              status: 'timeout',
              message: 'Arduino did not respond',
              employee: dbData ? dbData.fullname : null
            }));
          }
        }, 5000);
        
        const { enrollmentStatus } = req.server;
        enrollmentStatus.validationSlot = parseInt(slot);
        enrollmentStatus.validationCallback = (exists) => {
          responseReceived = true;
          clearTimeout(timeout);
          
          const synced = existsInDB === exists;
          
          resolve(reply.send({
            success: true,
            slot: parseInt(slot),
            existsInDB,
            existsInHardware: exists,
            synced,
            status: synced ? 'synced' : 'out_of_sync',
            message: synced 
              ? 'Fingerprint is synchronized' 
              : existsInDB && !exists
                ? 'Fingerprint exists in database but not in hardware'
                : !existsInDB && exists
                  ? 'Fingerprint exists in hardware but not in database'
                  : 'Unknown sync error',
            employee: dbData ? dbData.fullname : null,
            recommendation: !synced && existsInDB && !exists
              ? 'Re-enroll this fingerprint'
              : !synced && !existsInDB && exists
                ? 'Delete from hardware or register in database'
                : null
          }));
        };
        
        port.write(command, (err) => {
          if (err) {
            responseReceived = true;
            clearTimeout(timeout);
            console.error('❌ Error writing to Arduino:', err);
            resolve(reply.status(500).send({ 
              error: 'Failed to communicate with device',
              existsInDB 
            }));
          } else {
            console.log('✅ Validation command sent to Arduino:', command);
          }
        });
      });
      
    } catch (error) {
      console.error('❌ Error validating fingerprint:', error);
      return reply.status(500).send({ error: 'Validation failed' });
    }
  };

  const syncCheck = async (req, reply) => {
    const { port } = req.server;
    
    console.log('🔄 Starting full sync check...');
    
    try {
      const dbFingerprints = await pg.query(
        `SELECT ef.fingerprint_slot, ef.employee_id, e.fullname
         FROM employee_fingerprints ef
         JOIN employees e ON ef.employee_id = e.employee_id
         WHERE ef.status = $1
         ORDER BY ef.fingerprint_slot`,
        ['Active']
      );
      
      const dbSlots = new Set(dbFingerprints.rows.map(r => r.fingerprint_slot));
      
      return new Promise((resolve) => {
        const command = 'SCAN_ALL\n';
        let responseReceived = false;
        
        const timeout = setTimeout(() => {
          if (!responseReceived) {
            resolve(reply.status(504).send({
              error: 'Arduino did not respond to sync check'
            }));
          }
        }, 30000);
        
        const { enrollmentStatus } = req.server;
        enrollmentStatus.syncCheckCallback = (hardwareSlots) => {
          responseReceived = true;
          clearTimeout(timeout);
          
          const hwSet = new Set(hardwareSlots);
          
          const inDBNotInHW = [...dbSlots].filter(slot => !hwSet.has(slot));
          const inHWNotInDB = [...hwSet].filter(slot => !dbSlots.has(slot));
          const synced = [...dbSlots].filter(slot => hwSet.has(slot));
          
          const issues = [];
          
          inDBNotInHW.forEach(slot => {
            const emp = dbFingerprints.rows.find(r => r.fingerprint_slot === slot);
            issues.push({
              slot,
              issue: 'db_only',
              employee_id: emp?.employee_id,
              employee_name: emp?.fullname,
              message: `Slot ${slot} (${emp?.fullname}) exists in database but not in hardware`,
              recommendation: 'Re-enroll this fingerprint'
            });
          });
          
          inHWNotInDB.forEach(slot => {
            issues.push({
              slot,
              issue: 'hardware_only',
              message: `Slot ${slot} exists in hardware but not in database`,
              recommendation: 'Delete from hardware or register in database'
            });
          });
          
          resolve(reply.send({
            success: true,
            summary: {
              total_in_db: dbSlots.size,
              total_in_hardware: hwSet.size,
              synced: synced.length,
              issues: issues.length
            },
            synced_slots: synced,
            issues,
            database_fingerprints: dbFingerprints.rows.map(r => ({
              slot: r.fingerprint_slot,
              employee_id: r.employee_id,
              employee_name: r.fullname,
              in_hardware: hwSet.has(r.fingerprint_slot)
            })),
            hardware_slots: [...hwSet]
          }));
        };
        
        port.write(command, (err) => {
          if (err) {
            responseReceived = true;
            clearTimeout(timeout);
            console.error('❌ Error writing to Arduino:', err);
            resolve(reply.status(500).send({ error: 'Failed to communicate with device' }));
          } else {
            console.log('✅ Sync check command sent to Arduino');
          }
        });
      });
      
    } catch (error) {
      console.error('❌ Error during sync check:', error);
      return reply.status(500).send({ error: 'Sync check failed' });
    }
  };

  const clearHardwareSlot = async (req, reply) => {
    const { slot } = req.params;
    const { port } = req.server;
    
    console.log('🗑️ Clearing hardware slot:', slot);
    
    try {
      return new Promise((resolve) => {
        const command = `DELETE_SLOT:${slot}\n`;
        let responseReceived = false;
        
        const timeout = setTimeout(() => {
          if (!responseReceived) {
            resolve(reply.status(504).send({
              error: 'Arduino did not respond'
            }));
          }
        }, 5000);
        
        const { enrollmentStatus } = req.server;
        enrollmentStatus.deleteSlotCallback = (success, message) => {
          responseReceived = true;
          clearTimeout(timeout);
          
          if (success) {
            resolve(reply.send({
              success: true,
              message: `Slot ${slot} cleared from hardware`,
              slot: parseInt(slot)
            }));
          } else {
            resolve(reply.status(400).send({
              success: false,
              error: message || 'Failed to clear slot'
            }));
          }
        };
        
        port.write(command, (err) => {
          if (err) {
            responseReceived = true;
            clearTimeout(timeout);
            console.error('❌ Error writing to Arduino:', err);
            resolve(reply.status(500).send({ error: 'Failed to communicate with device' }));
          } else {
            console.log('✅ Delete slot command sent to Arduino');
          }
        });
      });
      
    } catch (error) {
      console.error('❌ Error clearing hardware slot:', error);
      return reply.status(500).send({ error: 'Failed to clear slot' });
    }
  };

  const enrollDigitalFingerprint = async (req, reply) => {
    const { employee_id, slot, fingerprint_data, enrollment_type } = req.body;
    
    console.log('🖐️ Starting digital enrollment:', { 
      employee_id, 
      slot, 
      enrollment_type,
      has_fingerprint_data: !!fingerprint_data 
    });
    
    try {
      if (!slot || slot < 1 || slot > 127) {
        return reply.status(400).send({ error: 'Invalid slot number. Must be between 1-127' });
      }

      if (!fingerprint_data || !fingerprint_data.template_id) {
        console.log('❌ Invalid fingerprint data:', fingerprint_data);
        return reply.status(400).send({ error: 'Invalid fingerprint data' });
      }

      // ✅ CHECK: Does employee already have a fingerprint?
      const existingFingerprint = await checkEmployeeFingerprint(employee_id);
      if (existingFingerprint) {
        console.log('❌ Employee already has fingerprint:', existingFingerprint);
        return reply.status(400).send({ 
          error: `This employee already has a fingerprint registered in slot ${existingFingerprint.fingerprint_slot}`,
          existing: existingFingerprint
        });
      }

      const existing = await pg.query(
        `SELECT ef.*, e.fullname 
        FROM employee_fingerprints ef
        LEFT JOIN employees e ON ef.employee_id = e.employee_id
        WHERE ef.fingerprint_slot = $1 AND (ef.status != $2 OR ef.status IS NULL)`,
        [slot, 'Deleted']
      );
      
      if (existing.rows.length > 0) {
        const occupied = existing.rows[0];
        return reply.status(400).send({ 
          error: `Slot ${slot} is already occupied by ${occupied.fullname || occupied.employee_id}`,
          occupied_by: {
            employee_id: occupied.employee_id,
            fullname: occupied.fullname,
            status: occupied.status
          }
        });
      }
      
      const employee = await pg.query(
        'SELECT employee_id, fullname FROM employees WHERE employee_id = $1',
        [employee_id]
      );
      
      if (employee.rows.length === 0) {
        return reply.status(404).send({ error: 'Employee not found' });
      }

      // ✅ IMPORTANT: For digital-only fingerprints, store in database WITHOUT Arduino
      // Arduino sensors typically don't support uploading arbitrary templates
      try {
        const insertRes = await pg.query(
          `INSERT INTO employee_fingerprints 
          (employee_id, fingerprint_slot, status, fingerprint_data, enrollment_type)
          VALUES ($1, $2, $3, $4::jsonb, $5)
          RETURNING *`,
          [employee_id, slot, 'Active', JSON.stringify(fingerprint_data), 'digital']
        );

        const fingerprintRecord = insertRes.rows[0];
        
        console.log(`✅ Digital fingerprint registered: Employee ${employee_id} -> Slot ${slot}`);
        
        setImmediate(async () => {
          try {
            await syncRow('employee_fingerprints', fingerprintRecord, 'fingerprint_id');
            console.log('✅ Synced to Supabase');
          } catch (err) {
            console.error("❌ Supabase sync error:", err.message);
          }
        });
        
        return reply.send({
          success: true,
          message: 'Digital fingerprint enrolled successfully (database only)',
          data: {
            fingerprint_id: fingerprintRecord.fingerprint_id,
            employee_id: fingerprintRecord.employee_id,
            slot: fingerprintRecord.fingerprint_slot,
            enrollment_type: fingerprintRecord.enrollment_type,
            registered_at: fingerprintRecord.registered_at,
            stored_in_hardware: false
          }
        });
        
      } catch (dbError) {
        console.error('❌ Database error:', dbError);
        
        if (dbError.code === '23505') {
          return reply.status(409).send({ 
            error: `Slot ${slot} was occupied during enrollment`,
            details: 'Please refresh and select a different slot.'
          });
        }
        
        return reply.status(500).send({ 
          error: 'Failed to save to database',
          details: dbError.message 
        });
      }
        
    } catch (error) {
      console.error('❌ Error enrolling digital fingerprint:', error);
      return reply.status(500).send({ 
        error: 'Failed to enroll digital fingerprint',
        details: error.message 
      });
    }
  };

  const validateFingerprint = async (req, reply) => {
    const { employee_id, slot } = req.query;
    
    try {
      let query = 'SELECT * FROM employee_fingerprints WHERE status = $1';
      const params = ['Active'];
      
      if (employee_id) {
        params.push(employee_id);
        query += ` AND employee_id = ${params.length}`;
      }
      
      if (slot) {
        params.push(slot);
        query += ` AND fingerprint_slot = ${params.length}`;
      }
      
      const result = await pg.query(query, params);
      
      if (result.rows.length === 0) {
        return reply.status(404).send({ 
          error: 'Fingerprint not found',
          exists: false 
        });
      }
      
      return reply.send({ 
        exists: true,
        data: result.rows[0]
      });
      
    } catch (error) {
      console.error('❌ Error validating fingerprint:', error);
      return reply.status(500).send({ error: 'Validation failed' });
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
    getFingerprintLogs,
    getEmployeesWithFingerprintStatus,
    validateHardwareFingerprint,
    syncCheck,
    clearHardwareSlot,
    enrollDigitalFingerprint,
    validateFingerprint
  };
}