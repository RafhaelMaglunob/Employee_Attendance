import schedule from 'node-schedule';
import { DateTime } from 'luxon';
import { syncRow } from './syncToSupabase.js';

// ========================================
// WHEN LEAVE REQUEST IS APPROVED
// ========================================

export async function handleLeaveRequestApproval(pool, io, leaveRequest) {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const { request_id, employee_id, start_date, end_date, type, status } = leaveRequest;

    // Only process if status is 'Approved'
    if (status !== 'Approved') {
      return;
    }

    console.log(`📅 Leave approved - ${type} from ${start_date} to ${end_date}`);

    // ========================================
    // STEP 1: Set employee status to "Leave" if leave has started
    // ========================================
    const today = new Date().toISOString().split('T')[0];
    const startDate = new Date(start_date).toISOString().split('T')[0];

    if (startDate <= today) {
      const updateResult = await client.query(
        `UPDATE employees
         SET status = 'Leave', updated_at = NOW()
         WHERE employee_id = $1
         RETURNING *`,
        [employee_id]
      );

      if (updateResult.rows.length > 0) {
        const employee = updateResult.rows[0];
        console.log(`✅ Employee ${employee.fullname} status set to Leave`);

        try {
          await syncRow('employees', employee, 'employee_id');
        } catch (err) {
          console.error(`Supabase sync error:`, err.message);
        }

        if (io) {
          io.emit('employee:status-changed', {
            employee_id,
            fullname: employee.fullname,
            status: 'Leave',
            leave_type: type,
            source: 'leave_approval'
          });
        }
      }
    }

    // ========================================
    // STEP 2: Save return schedule to database
    // ========================================
    const returnDate = new Date(end_date);
    returnDate.setDate(returnDate.getDate() + 1); // Day after leave ends
    const returnDateStr = returnDate.toISOString().split('T')[0];

    await client.query(
      `INSERT INTO leave_schedule (request_id, return_date, status)
       VALUES ($1, $2, 'Scheduled')
       ON CONFLICT (request_id) 
       DO UPDATE SET return_date = EXCLUDED.return_date, updated_at = NOW()`,
      [request_id, returnDateStr]
    );

    console.log(`📋 Scheduled return: ${returnDateStr}`);

    // ========================================
    // STEP 3: Schedule automatic revert
    // ========================================
    const returnTime = DateTime.fromISO(returnDateStr, { zone: 'Asia/Manila' })
      .set({ hour: 8, minute: 0, second: 0 });

    if (returnTime.isValid && returnTime > DateTime.now().setZone('Asia/Manila')) {
      schedule.scheduleJob(`return-${request_id}`, returnTime.toJSDate(), async () => {
        await handleLeaveReturn(pool, io, request_id);
      });

      console.log(`⏰ Scheduled return for ${returnDateStr} at 08:00 AM`);
    }

    await client.query('COMMIT');

  } catch (err) {
    await client.query('ROLLBACK');
    console.error('❌ Error handling leave approval:', err.message);
  } finally {
    client.release();
  }
}

// ========================================
// AUTOMATIC REVERT ON RETURN DATE
// ========================================

export async function handleLeaveReturn(pool, io, requestId) {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // Get leave request details
    const leaveRes = await client.query(
      `SELECT lr.*, e.employee_id, e.fullname 
       FROM leave_requests lr
       JOIN employees e ON lr.employee_id = e.employee_id
       WHERE lr.request_id = $1`,
      [requestId]
    );

    if (leaveRes.rows.length === 0) {
      console.log(`⚠️ Leave request ${requestId} not found`);
      return;
    }

    const { employee_id, fullname, type } = leaveRes.rows[0];

    // Update employee status back to Employed
    const updateResult = await client.query(
      `UPDATE employees
       SET status = 'Employed', updated_at = NOW()
       WHERE employee_id = $1
       RETURNING *`,
      [employee_id]
    );

    if (updateResult.rows.length > 0) {
      console.log(`✅ Employee ${fullname} status reverted to Employed`);

      try {
        await syncRow('employees', updateResult.rows[0], 'employee_id');
      } catch (err) {
        console.error(`Supabase sync error:`, err.message);
      }

      if (io) {
        io.emit('employee:status-changed', {
          employee_id,
          fullname,
          status: 'Employed',
          previous_status: 'Leave',
          leave_type: type,
          source: 'leave_return'
        });
      }
    }

    // Update leave_schedule status
    await client.query(
      `UPDATE leave_schedule
       SET status = 'Completed', updated_at = NOW()
       WHERE request_id = $1`,
      [requestId]
    );

    await client.query('COMMIT');

  } catch (err) {
    await client.query('ROLLBACK');
    console.error('❌ Error handling leave return:', err.message);
  } finally {
    client.release();
  }
}

// ========================================
// ON SERVER STARTUP: Restore pending schedules
// ========================================

export async function restorePendingLeaveSchedules(pool, io) {
  const client = await pool.connect();

  try {
    // Get all pending schedules (future return dates)
    const { rows: schedules } = await client.query(
      `SELECT ls.*, lr.type, e.employee_id, e.fullname
       FROM leave_schedule ls
       JOIN leave_requests lr ON ls.request_id = lr.request_id
       JOIN employees e ON lr.employee_id = e.employee_id
       WHERE ls.status = 'Scheduled'
         AND ls.return_date > CURRENT_DATE`
    );

    console.log(`📋 Restoring ${schedules.length} pending leave schedule(s)...`);

    for (const item of schedules) {
      const returnTime = DateTime.fromISO(item.return_date.toString(), { zone: 'Asia/Manila' })
        .set({ hour: 8, minute: 0, second: 0 });

      if (returnTime.isValid && returnTime > DateTime.now().setZone('Asia/Manila')) {
        schedule.scheduleJob(`return-${item.request_id}`, returnTime.toJSDate(), async () => {
          await handleLeaveReturn(pool, io, item.request_id);
        });

        console.log(`⏰ Restored: ${item.fullname} returns on ${item.return_date}`);
      }
    }

    console.log('✅ All leave schedules restored');

  } catch (err) {
    console.error('❌ Error restoring leave schedules:', err.message);
  } finally {
    client.release();
  }
}

// ========================================
// HOURLY CATCH-UP: Handle missed return dates
// ========================================

export async function initLeaveReturnCatchUp(pool, io) {
  return new Promise((resolve) => {
    schedule.scheduleJob('0 * * * *', async () => {
      const client = await pool.connect();
      try {
        const { rows: missedReturns } = await client.query(
          `SELECT request_id
           FROM leave_schedule
           WHERE status = 'Scheduled'
             AND return_date <= CURRENT_DATE`
        );

        for (const item of missedReturns) {
          await handleLeaveReturn(pool, io, item.request_id);
        }
      } catch (err) {
        console.error('❌ Catch-up error:', err.message);
      } finally {
        client.release();
      }
    });

    console.log('✅ Leave catch-up scheduler initialized');
    resolve(); // resolves immediately after scheduling
  });
}
