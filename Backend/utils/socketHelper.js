// utils/socketHelper.js
import { getIo } from "../socket.js";

/**
 * Emit request update to specific employee and all admins
 */
export const emitRequestUpdate = (io, request) => {
  const eventMap = {
    leave: 'leaveRequestUpdated',
    overtime: 'overtimeRequestUpdated',
    'off-set': 'offsetRequestUpdated' // Note: using 'offsetRequestUpdated' consistently
  };

  const eventName = eventMap[request.request_type];
  
  if (!eventName) {
    console.warn('⚠️ Unknown request type:', request.request_type);
    return;
  }

  const payload = {
    request_id: request.request_id,
    employee_id: request.employee_id,
    employee_name: request.employee_name,
    request_type: request.request_type,
    type: request.type,
    status: request.status?.toLowerCase(),
    remarks: request.remarks,
    reason: request.reason,
    link: request.attach_link || request.link,
    admin_comment: request.remarks,
    created_at: request.created_at,
    ...(request.request_type === 'leave' ? {
      days: request.days,
      start_date: request.start_date,
      end_date: request.end_date,
      date: null,
      hours: 0
    } : {
      date: request.date,
      hours: request.hours,
      start_date: null,
      end_date: null,
      days: 0
    })
  };

  // Emit to specific employee room
  io.to(`employee_${request.employee_id}`).emit(eventName, payload);
  
  // Emit to all admins (consolidated event)
  io.emit('adminRequestUpdated', payload);
  
  console.log(`📡 Emitted ${eventName} to employee_${request.employee_id} and admins`);
};

/**
 * Emit request deletion to specific employee and all admins
 */
export const emitRequestDelete = (io, requestId, requestType, employeeId) => {
  const eventMap = {
    leave: 'leaveRequestDeleted',
    overtime: 'overtimeRequestDeleted',
    'off-set': 'offsetRequestDeleted'
  };

  const payload = {
    request_id: requestId,
    request_type: requestType,
    employee_id: employeeId
  };

  // Emit to specific employee
  io.to(`employee_${employeeId}`).emit(eventMap[requestType], payload);
  
  // Emit to all admins
  io.emit('adminRequestDeleted', payload);
  
  console.log(`🗑️ Emitted delete for request ${requestId} to employee_${employeeId} and admins`);
};

/**
 * Emit notification update to specific employee
 */
export const emitNotificationUpdate = (io, employeeId, notification) => {
  io.to(`employee_${employeeId}`).emit('notificationReceived', {
    notification,
    timestamp: new Date()
  });
  
  console.log(`🔔 Emitted notification to employee_${employeeId}`);
};

/**
 * Emit notification count update to specific employee
 */
export const emitNotificationCountUpdate = (io, employeeId, count) => {
  io.to(`employee_${employeeId}`).emit('notificationCountUpdated', { 
    count,
    employee_id: employeeId 
  });
  
  console.log(`🔔 Updated notification count for employee_${employeeId}: ${count}`);
};