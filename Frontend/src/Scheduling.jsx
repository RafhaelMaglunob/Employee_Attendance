import React, { useState, useEffect, useMemo } from "react";
import { format, addDays, startOfWeek, addWeeks } from "date-fns";
import { Card } from "./component/ui/card";
import { Table } from "./component/data/table";

import CalendarModal from "./component/modals/CalendarModal";
export default function Scheduling() {
  const [weekStart, setWeekStart] = useState(startOfWeek(new Date(), { weekStartsOn: 1 }));
  const [scheduleData, setScheduleData] = useState([]);
  const [selectedEmployee, setSelectedEmployee] = useState('');
  const [showCalendar, setShowCalendar] = useState(false);
  const [shiftDate, setShiftDate] = useState('');
  const [timeIn, setTimeIn] = useState('');
  const [timeOut, setTimeOut] = useState('');
  const [roleAssignment, setRoleAssignment] = useState('');
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(false);

  const days = Array.from({ length: 7 }).map((_, i) => addDays(weekStart, i));
  const dayLabels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

  useEffect(() => { fetchEmployees(); }, []);
  useEffect(() => { fetchSchedule(); }, [weekStart]);

  const fetchEmployees = async () => {
    try {
      const res = await fetch('http://localhost:3001/api/employees');
      const data = await res.json();
      if (data.success) setEmployees(data.data.filter(e => e.status === 'Employed' || e.status === 'Probationary'));
    } catch (err) { console.error(err); }
  };

  const fetchSchedule = async () => {
    try {
      setLoading(true);
      const startDate = format(days[0], 'yyyy-MM-dd');
      const endDate = format(days[6], 'yyyy-MM-dd');
      const res = await fetch(`http://localhost:3001/api/schedule?start=${startDate}&end=${endDate}`);
      const data = await res.json();
      if (data.success) setScheduleData(data.data);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  const prevWeek = () => setWeekStart(addWeeks(weekStart, -1));
  const nextWeek = () => setWeekStart(addWeeks(weekStart, 1));

  const getEmployeeSchedule = (employeeId, date) => {
    const dateStr = format(date, 'yyyy-MM-dd');
    return scheduleData.filter(s => s.employee_id === employeeId && s.work_date === dateStr);
  };

  const handleAddShift = async () => {
    if (!selectedEmployee || !shiftDate || !timeIn || !timeOut) return alert('Please fill all fields');
    try {
      const res = await fetch('http://localhost:3001/api/schedule', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          employee_id: selectedEmployee,
          work_date: shiftDate,
          start_time: timeIn,
          end_time: timeOut,
          task: roleAssignment || 'Regular Shift',
          status: 'approved'
        })
      });
      const data = await res.json();
      if (data.success) {
        fetchSchedule();
        setSelectedEmployee(''); setShiftDate(''); setTimeIn(''); setTimeOut(''); setRoleAssignment('');
      } else alert(data.message || 'Failed to add shift');
    } catch (err) { console.error(err); alert('Error adding shift'); }
  };

  const handleDeleteShift = async (scheduleId) => {
    if (!confirm('Are you sure you want to delete this shift?')) return;
    try {
      const res = await fetch(`http://localhost:3001/api/schedule/${scheduleId}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) fetchSchedule();
    } catch (err) { console.error(err); }
  };

  const columns = [
    { key: 'employee', title: 'Employee', render: row => <div className="font-medium">{row.fullname}</div> },
    ...days.map((day, idx) => ({
      key: `day_${idx}`,
      title: dayLabels[idx],
      render: row => {
        const shifts = getEmployeeSchedule(row.employee_id, day);
        if (shifts.length === 0) return <span className="text-xs text-gray-400">No shift</span>;
        return shifts.map((shift, i) => (
          <div
            key={i}
            className="bg-yellow-200 rounded px-2 py-1 text-xs cursor-pointer hover:bg-yellow-300 mb-1"
            onClick={() => handleDeleteShift(shift.schedule_id)}
            title="Click to delete"
          >
            <div className="font-semibold">{shift.start_time?.substring(0,5)} - {shift.end_time?.substring(0,5)}</div>
            {shift.task && <div className="text-[10px] text-gray-600">✏️ {shift.task}</div>}
          </div>
        ));
      }
    }))
  ];

  return (
    <div className="p-4 font-inter">
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-2xl font-bold">Scheduling</h1>
        <div className="flex gap-2">
          <div 
            onClick={() => setShowCalendar(true)}
            className="bg-white border hover:cursor-pointer px-2 sm:px-4 py-2 rounded-lg items-center flex flex-row space-x-2 sm:space-x-3 font-inter hover:bg-gray-400/30"
          >
            <img src="../img/Date_Icon.png" alt="Date" className="w-4 h-4 sm:w-6 sm:h-6" />
            <button className="text-sm"> View Calendar</button>
          </div>
        </div>
      </div>

      <Card title={`Weekly Schedule (${format(days[0], 'MMM d')} - ${format(days[6], 'MMM d, yyyy')})`} variant="admin">
        <Table columns={columns} data={employees} className="min-w-full" />
         <div className="flex justify-between items-center mt-3">
          <button
            onClick={() => setWeekStart(addWeeks(weekStart, -1))}
            className="px-3 py-1 rounded hover:bg-white/60 cursor-pointer"
          >
            &lt; Previous
          </button>
          <span>
            <span className="hidden sm:block">Weekly Schedule</span> ({format(days[0], 'MMM d')} - {format(days[6], 'MMM d, yyyy')})
          </span>
          <button
            onClick={() => setWeekStart(addWeeks(weekStart, 1))}
            className="px-3 py-1 rounded hover:bg-white/60 cursor-pointer"
          >
            Next &gt;
          </button>
        </div>
      </Card>

      {/* Add shift panel remains the same */}
      <Card title="Add/View Schedule" variant="admin" className="mt-4">
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Select Employee</label>
            <select 
              value={selectedEmployee}
              onChange={e => setSelectedEmployee(e.target.value)}
              className="w-full border bg-white border-gray-300 rounded px-3 py-2 text-sm"
            >
              <option value="">Choose employee...</option>
              {employees.map(emp => <option key={emp.employee_id} value={emp.employee_id}>{emp.fullname}</option>)}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Shift Date</label>
            <input type="date" value={shiftDate} onChange={e => setShiftDate(e.target.value)} className="bg-white w-full border border-gray-300 rounded px-3 py-2 text-sm" />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-sm font-medium mb-1">Time In</label>
              <input type="time" value={timeIn} onChange={e => setTimeIn(e.target.value)} className="bg-white w-full border border-gray-300 rounded px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Time Out</label>
              <input type="time" value={timeOut} onChange={e => setTimeOut(e.target.value)} className="bg-white w-full border border-gray-300 rounded px-3 py-2 text-sm" />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Role Assignment</label>
            <input type="text" value={roleAssignment} onChange={e => setRoleAssignment(e.target.value)} placeholder="e.g., Opening, Closing, Manager" className="bg-white w-full border border-gray-300 rounded px-3 py-2 text-sm" />
          </div>

          <button onClick={handleAddShift} className="w-full bg-black text-white py-3 rounded font-medium hover:bg-gray-800">
            Add Shift
          </button>
        </div>
      </Card>
      {showCalendar && <CalendarModal onClose={() => setShowCalendar(false)} />}
    </div>
  );
}
