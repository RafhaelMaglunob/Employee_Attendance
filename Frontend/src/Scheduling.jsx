import React, { useState, useEffect } from "react";
import { format, addDays, startOfWeek, addWeeks } from "date-fns";
import { Card } from "./component/ui/card";
import { Table } from "./component/data/table";
import CalendarModal from "./component/modals/CalendarModal";

export default function Scheduling() {
  const [weekStart, setWeekStart] = useState(startOfWeek(new Date(), { weekStartsOn: 1 }));
  const [employees, setEmployees] = useState([]);
  const [schedules, setSchedules] = useState([]);
  const [showCalendar, setShowCalendar] = useState(false);
  const [loading, setLoading] = useState(false);

  // Generate days array based on weekStart
  const days = Array.from({ length: 7 }).map((_, i) => addDays(weekStart, i));
  const dayLabels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

  useEffect(() => { 
    fetchSchedule(); 
  }, [weekStart]);

  const fetchSchedule = async () => {
    try {
      setLoading(true);
      const startDate = format(days[0], 'yyyy-MM-dd');
      const endDate = format(days[6], 'yyyy-MM-dd');
      
      console.log('📅 Fetching schedules:', { startDate, endDate });
      
      const res = await fetch(
        `http://192.168.1.9:3001/api/schedule?start=${startDate}&end=${endDate}`
      );
      const data = await res.json();
      
      if (data.success) {
        const emps = data.data.employees || [];
        const schs = data.data.schedules || [];
        
        setEmployees(emps);
        setSchedules(schs);
        
        console.log('✅ Loaded employees:', emps.length);
        console.log('✅ Loaded schedules:', schs.length);
      } else {
        console.error('❌ Failed to fetch schedules:', data.message);
        setEmployees([]);
        setSchedules([]);
      }
    } catch (err) { 
      console.error('❌ Error fetching schedules:', err);
      setEmployees([]);
      setSchedules([]);
    } finally { 
      setLoading(false); 
    }
  };

  // Get shifts for a specific employee on a specific date
  const getEmployeeShiftsForDate = (employeeId, date) => {
    const dateStr = format(date, 'yyyy-MM-dd');
    const shifts = schedules.filter(
      s => s.employee_id === employeeId && s.work_date === dateStr
    );
    return shifts;
  };

  // Format time from HH:MM:SS to HH:MM AM/PM (military to 12-hour)
  const formatTime = (timeStr) => {
    if (!timeStr) return '';
    try {
      const [hours, minutes, seconds] = timeStr.split(':');
      const hour = parseInt(hours);
      const min = parseInt(minutes);
      const ampm = hour >= 12 ? 'PM' : 'AM';
      const displayHour = hour % 12 || 12;
      return `${displayHour}:${String(min).padStart(2, '0')} ${ampm}`;
    } catch (e) {
      console.error('Error formatting time:', timeStr, e);
      return timeStr;
    }
  };

  const columns = [
    { 
      key: 'employee', 
      title: 'Employee', 
      render: row => (
        <div className="font-medium whitespace-nowrap">{row.fullname}</div>
      )
    },
    ...days.map((day, idx) => ({
      key: `day_${idx}`,
      title: (
        <div className="text-center">
          <div className="font-semibold">{dayLabels[idx]}</div>
          <div className="text-xs text-gray-500">{format(day, 'MMM d')}</div>
        </div>
      ),
      render: row => {
        const shifts = getEmployeeShiftsForDate(row.employee_id, day);
        
        if (shifts.length === 0) {
          return (
            <div className="text-center">
              <span className="text-xs text-gray-400">No shift</span>
            </div>
          );
        }
        
        return (
          <div className="space-y-2">
            {shifts.map((shift, i) => (
              <div
                key={i}
                className="bg-green-100 border border-green-400 rounded px-2 py-1 text-xs"
              >
                <div className="font-semibold text-green-900">
                  {formatTime(shift.start_time)} - {formatTime(shift.end_time)}
                </div>
                {shift.task && (
                  <div className="text-[10px] text-green-700 truncate">
                    ✏️ {shift.task}
                  </div>
                )}
                {shift.status && (
                  <div className="text-[10px] text-green-600 capitalize">
                    {shift.status}
                  </div>
                )}
              </div>
            ))}
          </div>
        );
      }
    }))
  ];

  return (
    <div className="p-4 font-inter h-full flex flex-col">
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-2xl font-bold">Scheduling</h1>
        <div className="flex gap-2">
          <button 
            onClick={() => setShowCalendar(true)}
            className="bg-white border hover:cursor-pointer px-2 sm:px-4 py-2 rounded-lg items-center flex flex-row space-x-2 sm:space-x-3 font-inter hover:bg-gray-400/30 transition-colors"
          >
            <img src="../img/Date_Icon.png" alt="Date" className="w-4 h-4 sm:w-6 sm:h-6" />
            <span className="text-sm">View Calendar</span>
          </button>
        </div>
      </div>

      <Card 
        title={`Weekly Schedule (${format(days[0], 'MMM d')} - ${format(days[6], 'MMM d, yyyy')})`} 
        variant="admin"
        className="flex-1 min-h-0"
      >
        {loading ? (
          <div className="text-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mx-auto"></div>
            <p className="mt-2 text-gray-600">Loading schedules...</p>
          </div>
        ) : employees.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            No employees found
          </div>
        ) : (
          <div className="flex flex-col h-full min-h-0">
            {/* Scrollable table wrapper */}
            <div className="overflow-x-auto overflow-y-auto flex-1 min-h-0">
              <div className="max-w-250">
                <Table columns={columns} data={employees} className="" />
              </div>
            </div>

            {/* Week navigation */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 sm:gap-x-4 items-center mt-4 pt-4 border-t">
              <button
                onClick={() => setWeekStart(addWeeks(weekStart, -1))}
                className="sm:px-4 sm:py-2 px-2 py-1 text-sm sm:text-base rounded bg-gray-100 hover:bg-gray-200 transition-colors whitespace-nowrap"
              >
                ← Previous Week
              </button>

              <span className="text-xs sm:text-sm text-center text-gray-600 whitespace-nowrap px-4">
                {format(days[0], 'MMM d')} - {format(days[6], 'MMM d, yyyy')}
              </span>

              <button
                onClick={() => setWeekStart(addWeeks(weekStart, 1))}
                className="sm:px-4 sm:py-2 px-2 py-1 text-sm sm:text-base rounded bg-gray-100 hover:bg-gray-200 transition-colors whitespace-nowrap"
              >
                Next Week →
              </button>
            </div>
          </div>

        )}
      </Card>


      {showCalendar && (
        <CalendarModal 
          onClose={() => setShowCalendar(false)} 
          onSelectDate={(weekStartDate) => setWeekStart(weekStartDate)}
        />
      )}
    </div>
  );
}