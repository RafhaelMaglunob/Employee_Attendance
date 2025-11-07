import { syncRow } from '../utils/syncToSupabase.js';

export function fingerprintController(pg) {
  
  // Check if employee already has a fingerprint registered
  const checkEmployeeFingerprint = async (employee_id) => {
    const result = await pg.query(
      `SELECT ef.fingerprint_slot, ef.fingerprint_id 
       FROM employee_fingerprints ef
       WHERE ef.employee_id = $1 AND ef.status = $2`,
      [employee_id, 'Active']
    );
    return result.rows.length > 0 ? result.rows[0] : null;
  };

  // Start fingerprint enrollment (hardware only)
  const startEnrollment = async (req, reply) => {
    const { employee_id, slot } = req.body;
    
    console.log('🚀 Starting enrollment:', { employee_id, slot });
    
    try {
      // Validate slot number
      if (!slot || slot < 1 || slot > 127) {
        return reply.status(400).send({ error: 'Invalid slot number. Must be between 1-127' });
      }

      // CHECK: Does employee already have a fingerprint?
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
         WHERE ef.fingerprint_slot = $1 AND ef.status = $2`,
        [slot, 'Active']
      );
      
      if (existing.rows.length > 0) {
        const occupied = existing.rows[0];
        console.log('❌ Slot already occupied:', {
          slot,
          by: occupied.employee_id,
          name: occupied.fullname
        });
        return reply.status(400).send({ 
          error: `Slot ${slot} is already occupied by ${occupied.fullname || occupied.employee_id}`,
          occupied_by: {
            employee_id: occupied.employee_id,
            fullname: occupied.fullname
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
      
      // Send command to Arduino (hardware only)
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

  // Get enrollment status - KEPT YOUR WORKING VERSION
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

  // Handle attendance clock from Arduino
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

      // Sync all updates to Supabase
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

  // Delete fingerprint registration - FIXED FOR RE-ENROLLMENT
  const deleteFingerprint = async (req, reply) => {
    let { slot } = req.params;
    const { port } = req.server;
    
    try {
      // Clean slot - remove any extra characters and convert to integer
      slot = parseInt(slot, 10);
      
      if (isNaN(slot) || slot < 1 || slot > 127) {
        return reply.status(400).send({ success: false, error: 'Invalid slot number. Must be 1-127' });
      }
      
      console.log(`🗑️ Deleting fingerprint from slot ${slot}`);
      
      // Get the fingerprint record first
      const getRes = await pg.query(
        'SELECT * FROM employee_fingerprints WHERE fingerprint_slot = $1 AND status = $2 LIMIT 1',
        [slot, 'Active']
      );
      
      if (getRes.rows.length === 0) {
        return reply.status(404).send({ success: false, error: 'Fingerprint not found in database' });
      }
      
      const fingerprintRecord = getRes.rows[0];
      let hardwareDeleted = false;
      
      // Send delete command to Arduino first
      return new Promise((resolve) => {
        const command = `DELETE_SLOT:${slot}\n`;
        let responseReceived = false;
        
        const timeout = setTimeout(() => {
          if (!responseReceived) {
            responseReceived = true;
            console.log('⏱️ Arduino response timeout - deleting from database anyway');
            
            // Delete from database
            pg.query(
              'DELETE FROM employee_fingerprints WHERE fingerprint_slot = $1 RETURNING *',
              [slot]
            ).then((result) => {
              console.log(`✅ Database record deleted for slot ${slot}`);
              
              // Sync deletion to Supabase
              setImmediate(async () => {
                try {
                  await syncRow('employee_fingerprints', { ...fingerprintRecord, status: 'Deleted' }, 'fingerprint_id');
                  console.log('✅ Synced to Supabase');
                } catch (err) {
                  console.error("❌ Supabase sync error:", err.message);
                }
              });
              
              resolve(reply.send({ success: true, message: 'Fingerprint deleted successfully' }));
            }).catch((err) => {
              console.error('❌ Database deletion error:', err);
              resolve(reply.send({ success: true, message: 'Fingerprint deleted from hardware' }));
            });
          }
        }, 3000);
        
        const { enrollmentStatus } = req.server;
        enrollmentStatus.deleteSlotCallback = (success, message) => {
          if (!responseReceived) {
            responseReceived = true;
            clearTimeout(timeout);
            hardwareDeleted = true;
            
            console.log(`✅ Arduino confirmed deletion: ${message}`);
            
            // Now delete from database
            pg.query(
              'DELETE FROM employee_fingerprints WHERE fingerprint_slot = $1 RETURNING *',
              [slot]
            ).then((result) => {
              console.log(`✅ Database record deleted for slot ${slot}`);
              
              // Sync deletion to Supabase
              setImmediate(async () => {
                try {
                  await syncRow('employee_fingerprints', { ...fingerprintRecord, status: 'Deleted' }, 'fingerprint_id');
                  console.log('✅ Synced to Supabase');
                } catch (err) {
                  console.error("❌ Supabase sync error:", err.message);
                }
              });
              
              resolve(reply.send({ success: true, message: 'Fingerprint deleted successfully' }));
            }).catch((err) => {
              console.error('❌ Database deletion error:', err);
              resolve(reply.send({ success: true, message: 'Fingerprint deleted from hardware' }));
            });
          }
        };
        
        port.write(command, (err) => {
          if (err) {
            if (!responseReceived) {
              responseReceived = true;
              clearTimeout(timeout);
              console.error('❌ Error writing to Arduino:', err);
              
              // Still delete from database
              pg.query(
                'DELETE FROM employee_fingerprints WHERE fingerprint_slot = $1 RETURNING *',
                [slot]
              ).then((result) => {
                console.log(`✅ Database record deleted for slot ${slot}`);
                resolve(reply.send({ success: true, message: 'Fingerprint deleted from database' }));
              }).catch((dbErr) => {
                console.error('❌ Database deletion error:', dbErr);
                resolve(reply.status(500).send({ success: false, error: 'Failed to delete fingerprint' }));
              });
            }
          } else {
            console.log('✅ Delete command sent to Arduino:', command);
          }
        });
      });
      
    } catch (error) {
      console.error('❌ Error deleting fingerprint:', error);
      return reply.status(500).send({ success: false, error: 'Failed to delete fingerprint' });
    }
  };

  // Get employees with fingerprint status (admin view)
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
      
      return reply.send({ 
        success: true, 
        employees: result.rows
      });
    } catch (error) {
      console.error('❌ Error fetching employees:', error);
      return reply.status(500).send({ 
        success: false,
        error: 'Failed to fetch employees'
      });
    }
  };

  const startReenroll = async (req, reply) => {
    let { slot, employee_id } = req.body;

    try {
      slot = parseInt(slot, 10);
      if (isNaN(slot) || slot < 1 || slot > 127) {
        return reply.status(400).send({ success: false, error: 'Invalid slot number' });
      }

      console.log(`🔄 Starting re-enrollment for slot ${slot}, employee ${employee_id}`);

      // 1️⃣ Begin transaction
      await pg.query('BEGIN');

      // 2️⃣ Delete old fingerprint from main table (Active)
      const oldFpRes = await pg.query(
        'DELETE FROM employee_fingerprints WHERE fingerprint_slot = $1 AND status = $2 RETURNING *',
        [slot, 'Active']
      );

      // 3️⃣ Delete old fingerprint from archive
      await pg.query(
        'DELETE FROM employee_fingerprints_archive WHERE fingerprint_slot = $1',
        [slot]
      );

      // 4️⃣ Insert new fingerprint
      const newFp = await pg.query(
        `INSERT INTO employee_fingerprints (employee_id, fingerprint_slot, status, enrollment_type)
        VALUES ($1, $2, 'Active', 'hardware') RETURNING *`,
        [employee_id, slot]
      );

      // 5️⃣ Commit transaction
      await pg.query('COMMIT');

      setImmediate(async () => {
        try {
          // Delete old row first in Supabase
          await deleteRow('employee_fingerprints', 'fingerprint_slot', slot);
          await deleteRow('employee_fingerprints_archive', 'fingerprint_slot', slot);

          // Insert new fingerprint into Supabase
          await syncRow('employee_fingerprints', newFp.rows[0], 'fingerprint_id');

          console.log('✅ Supabase sync completed for re-enroll');
        } catch (err) {
          console.error('❌ Supabase sync error:', err.message);
        }
      });



      // 7️⃣ Hardware delete (Arduino)
      const { enrollmentStatus, port } = req.server;
      return new Promise((resolve) => {
        const command = `DELETE_SLOT:${slot}\n`;
        let responseReceived = false;

        const timeout = setTimeout(() => {
          if (!responseReceived) {
            responseReceived = true;
            console.log('⏱️ Arduino timeout - ready for new enrollment');
            resolve(reply.send({ 
              success: true, 
              message: 'Ready for re-enrollment. Backup deleted and new fingerprint inserted.',
              slot
            }));
          }
        }, 3000);

        enrollmentStatus.deleteSlotCallback = (success, message) => {
          if (!responseReceived) {
            responseReceived = true;
            clearTimeout(timeout);
            console.log(`✅ Hardware deleted: ${message}`);
            resolve(reply.send({ 
              success: true, 
              message: 'Ready for re-enrollment. Please enroll new fingerprint.',
              slot
            }));
          }
        };

        port.write(command, (err) => {
          if (err && !responseReceived) {
            responseReceived = true;
            clearTimeout(timeout);
            console.error('❌ Arduino error:', err);
            resolve(reply.send({ 
              success: true, 
              message: 'Backup deleted. Ready for re-enrollment.',
              slot
            }));
          } else {
            console.log('✅ Delete command sent to Arduino:', command);
          }
        });
      });

    } catch (error) {
      await pg.query('ROLLBACK'); // Undo partial changes
      console.error('❌ Re-enrollment error:', error);
      return reply.status(500).send({ success: false, error: 'Failed to start re-enrollment' });
    }
  };




  const cancelReenroll = async (req, reply) => {
    let { slot } = req.body;
    try {
      slot = parseInt(slot, 10);
      console.log(`↩️ Cancelling re-enrollment for slot ${slot}`);
      
      // Check backup
      const checkRes = await pg.query(
        'SELECT * FROM employee_fingerprints WHERE fingerprint_slot = $1 AND status = $2',
        [slot, 'PendingReenroll']
      );
      if (checkRes.rows.length === 0) {
        return reply.status(404).send({ success: false, error: 'No backup found' });
      }
      
      const backup = checkRes.rows[0];
      
      // Restore to Active
      const updateRes = await pg.query(
        `UPDATE employee_fingerprints 
        SET status = $1, updated_at = CURRENT_TIMESTAMP 
        WHERE fingerprint_slot = $2 
        RETURNING *`,
        ['Active', slot]
      );
      const restored = updateRes.rows[0];

      // Sync restored fingerprint to Supabase
      setImmediate(async () => {
        try {
          await syncRow('employee_fingerprints', restored, 'fingerprint_id');
          console.log('✅ Restored fingerprint synced to Supabase');
        } catch (err) {
          console.error('❌ Supabase sync error (restore):', err.message);
        }
      });

      console.log(`✅ Restored old fingerprint for slot ${slot}`);
      return reply.send({ success: true, message: 'Old fingerprint restored', slot });

    } catch (error) {
      console.error('❌ Cancel re-enrollment error:', error);
      return reply.status(500).send({ success: false, error: 'Failed to cancel re-enrollment' });
    }
  };

  const confirmReenroll = async (req, reply) => {
    let { slot } = req.body;
    try {
      slot = parseInt(slot, 10);
      console.log(`✅ Confirming re-enrollment for slot ${slot}`);
      
      // Delete old backup
      const deleteRes = await pg.query(
        'DELETE FROM employee_fingerprints WHERE fingerprint_slot = $1 AND status = $2 RETURNING *',
        [slot, 'PendingReenroll']
      );
      const deletedBackup = deleteRes.rows[0];
      
      // Sync deletion to Supabase
      if (deletedBackup) {
        setImmediate(async () => {
          try {
            await syncRow('employee_fingerprints', { ...deletedBackup, status: 'Deleted' }, 'fingerprint_id');
            console.log('✅ Old backup deletion synced to Supabase');
          } catch (err) {
            console.error('❌ Supabase sync error (delete backup):', err.message);
          }
        });
      }

      // Ensure new fingerprint is Active
      const updateRes = await pg.query(
        `UPDATE employee_fingerprints 
        SET status = $1 
        WHERE fingerprint_slot = $2 AND status != $3
        RETURNING *`,
        ['Active', slot, 'Active']
      );
      const newActive = updateRes.rows[0];

      // Sync new Active fingerprint
      if (newActive) {
        setImmediate(async () => {
          try {
            await syncRow('employee_fingerprints', newActive, 'fingerprint_id');
            console.log('✅ New Active fingerprint synced to Supabase');
          } catch (err) {
            console.error('❌ Supabase sync error (new active):', err.message);
          }
        });
      }

      return reply.send({ success: true, message: 'Re-enrollment confirmed. New fingerprint is active.', slot });

    } catch (error) {
      console.error('❌ Confirm re-enrollment error:', error);
      return reply.status(500).send({ success: false, error: 'Failed to confirm re-enrollment' });
    }
  };
  // Get fingerprint logs
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
      console.error('❌ Error fetching logs:', error);
      return reply.status(500).send({ error: 'Failed to fetch logs' });
    }
  };

  return {
    startEnrollment,
    getEnrollmentStatus,
    handleAttendanceClock,
    deleteFingerprint,
    getEmployeesWithFingerprintStatus,
    getFingerprintLogs,
    startReenroll,     
    cancelReenroll,      
    confirmReenroll
  };
}