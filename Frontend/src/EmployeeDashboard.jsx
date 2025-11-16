import React, { useState, useEffect, useMemo } from "react";
import { useFetchData } from "./component/hooks/useFetchData";
import { Card } from "./component/ui/card";
import { Table } from "./component/data/table";
import {
  format,
  addWeeks,
  subWeeks,
  startOfWeek,
  endOfWeek,
  addDays,
  parseISO,
  isSameDay,
  parse,
} from "date-fns";

function EmployeeDashboard() {
  const API_URL = 'http://192.168.1.9:3001';
  const employeeId = localStorage.getItem("employeeId");
  const employeeName = localStorage.getItem("fullname");
  const [currentWeek, setCurrentWeek] = useState(new Date());

  // Calculate week boundaries
  const weekStart = startOfWeek(currentWeek, { weekStartsOn: 1 }); // Monday start
  const weekEnd = endOfWeek(currentWeek, { weekStartsOn: 1 });
  
  // Fetch today's time logs (Clock In/Clock Out from employee_attendance)
  const { data: timeLogsData, loading: timeLogsLoading, refetch: refetchTimeLogs } = useFetchData(
    employeeId ? `${API_URL}/api/employee/timelogs/${employeeId}` : null
  );
  
  // Fetch ALL attendance data from employee_attendance table
  const { data: attendanceResponse, loading: attendanceLoading, refetch: refetchAttendance } = useFetchData(
    employeeId ? `${API_URL}/api/employee/attendance-data/${employeeId}` : null
  );

  // 🔍 DEBUG: Log full response structure
  useEffect(() => {
    if (timeLogsData) {
      console.log("🔥 TIME LOGS FULL RESPONSE:", JSON.stringify(timeLogsData, null, 2));
    }
  }, [timeLogsData]);

  useEffect(() => {
    if (attendanceResponse) {
      console.log("🔥 ATTENDANCE FULL RESPONSE:", JSON.stringify(attendanceResponse, null, 2));
    }
  }, [attendanceResponse]);

  // Extract attendance data array - Try both possible structures
  const allAttendanceData = useMemo(() => {
    // Case 1: If useFetchData returns { data: { success: true, data: [...] } }
    if (attendanceResponse?.data?.data) {
      console.log("✅ Using attendanceResponse.data.data");
      return attendanceResponse.data.data;
    }
    // Case 2: If useFetchData returns { success: true, data: [...] }
    if (attendanceResponse?.data) {
      console.log("✅ Using attendanceResponse.data");
      return attendanceResponse.data;
    }
    // Case 3: If useFetchData returns the array directly
    if (Array.isArray(attendanceResponse)) {
      console.log("✅ Using attendanceResponse (array)");
      return attendanceResponse;
    }
    console.log("❌ No valid attendance data structure found");
    return [];
  }, [attendanceResponse]);

  // Extract today's time logs with defaults
  const timeLogs = useMemo(() => {
    // Case 1: If useFetchData returns { data: { success: true, logs: {...} } }
    if (timeLogsData?.data?.logs) {
      console.log("✅ Using timeLogsData.data.logs");
      return timeLogsData.data.logs;
    }
    // Case 2: If useFetchData returns { success: true, logs: {...} }
    if (timeLogsData?.logs) {
      console.log("✅ Using timeLogsData.logs");
      return timeLogsData.logs;
    }
    console.log("❌ No valid time logs structure found");
    return {
      clock_in: null,
      clock_out: null,
      total_hours: 0,
      weekly_total: '0.00'
    };
  }, [timeLogsData]);

  // Calculate Weekly Hours (current week only)
  const weeklyHours = useMemo(() => {
    console.log("📊 ALL ATTENDANCE DATA:", allAttendanceData);
    console.log("📅 WEEK START:", weekStart);
    console.log("📅 WEEK END:", weekEnd);
    
    if (!allAttendanceData || allAttendanceData.length === 0) {
      console.log("❌ No attendance data");
      return { total: 0, days: 0 };
    }

    const weekRecords = allAttendanceData.filter(record => {
      const recordDate = new Date(record.date);
      console.log("🔍 Checking record:", record.date, "Between:", weekStart, "-", weekEnd);
      return recordDate >= weekStart && recordDate <= weekEnd;
    });

    console.log("✅ FILTERED WEEK RECORDS:", weekRecords);
    
    const totalHours = weekRecords
      .filter(record => record.hours_worked)
      .reduce((sum, record) => sum + parseFloat(record.hours_worked), 0);

    console.log("💰 TOTAL HOURS:", totalHours);

    const daysWorked = weekRecords.filter(r => r.clock_in && r.clock_out).length;

    return {
      total: Math.round(totalHours * 10) / 10,
      days: daysWorked
    };
  }, [allAttendanceData, weekStart, weekEnd]);

  // Calculate Total Hours (all time)
  const totalHours = useMemo(() => {
    if (!allAttendanceData || allAttendanceData.length === 0) {
      return { total: 0, days: 0 };
    }

    const allHours = allAttendanceData
      .filter(record => record.hours_worked)
      .reduce((sum, record) => sum + parseFloat(record.hours_worked), 0);

    const totalDays = allAttendanceData.filter(r => r.clock_in && r.clock_out).length;

    return {
      total: Math.round(allHours * 10) / 10,
      days: totalDays
    };
  }, [allAttendanceData]);

  // Calculate this month's hours
  const thisMonthHours = useMemo(() => {
    if (!allAttendanceData || allAttendanceData.length === 0) return 0;
    
    const now = new Date();
    return allAttendanceData
      .filter(r => {
        const d = new Date(r.date);
        return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
      })
      .reduce((sum, r) => sum + parseFloat(r.hours_worked || 0), 0)
      .toFixed(1);
  }, [allAttendanceData]);

  const weekDisplay =
    format(weekStart, "MMM") === format(weekEnd, "MMM")
      ? `${format(weekStart, "MMM d")} - ${format(weekEnd, "d")}`
      : `${format(weekStart, "MMM d")} - ${format(weekEnd, "MMM d")}`;

  const handlePrevWeek = () => setCurrentWeek(subWeeks(currentWeek, 1));
  const handleNextWeek = () => setCurrentWeek(addWeeks(currentWeek, 1));

  // Auto-refresh time logs every 30 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      if (refetchTimeLogs) refetchTimeLogs();
      if (refetchAttendance) refetchAttendance();
    }, 30000); // 30 seconds

    return () => clearInterval(interval);
  }, [refetchTimeLogs, refetchAttendance]);

  // Fetch employee schedule
  const { data: scheduleData = [] } = useFetchData(
    `${API_URL}/api/employee/schedule/${employeeId}`
  );

  // Columns for Morning / Evening shifts
  const columns = [
    { key: "day", title: "Day" },
    { key: "morning", title: "Morning Shift" },
    { key: "evening", title: "Evening Shift" },
  ];

  const dayNames = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

  // Generate table data for each day
  const tableData = dayNames.map((dayName, i) => {
    const dayDate = addDays(weekStart, i);
    const daySchedules = scheduleData.filter((s) =>
      isSameDay(parseISO(s.work_date), dayDate)
    );

    const formatTime = (timeStr) => {
      if (!timeStr) return "-";
      const parsed = parse(timeStr, "HH:mm:ss", new Date());
      return format(parsed, "h:mm a");
    };

    let morningShiftData = null;
    let eveningShiftData = null;

    daySchedules.forEach((shift) => {
      const startHour = parse(shift.start_time, "HH:mm:ss", new Date()).getHours();
      if (startHour >= 7 && startHour <= 13) morningShiftData = shift;
      else if (startHour >= 15 && startHour <= 20) eveningShiftData = shift;
    });

    const morningShift = morningShiftData ? (
      <div className="flex flex-col">
        <span className="whitespace-nowrap">
          {`${formatTime(morningShiftData.start_time)} - ${formatTime(morningShiftData.end_time)}`}
        </span>
        {morningShiftData.task && <span className="text-xs text-gray-600">({morningShiftData.task})</span>}
      </div>
    ) : "-";

    const eveningShift = eveningShiftData ? (
      <div className="flex flex-col">
        <span className="whitespace-nowrap">
          {`${formatTime(eveningShiftData.start_time)} - ${formatTime(eveningShiftData.end_time)}`}
        </span>
        {eveningShiftData.task && <span className="text-xs text-gray-600">({eveningShiftData.task})</span>}
      </div>
    ) : "-";

    return {
      key: i,
      day: dayName,
      morning: morningShift,
      evening: eveningShift,
    };
  });

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Weekly Schedule Card */}
        <Card radius="none" className="w-full">
          <div className="flex flex-col">
            <div className="flex flex-col space-y-3">
              <span className="flex flex-row space-x-3 items-center">
                <img src="../img/Date_Icon.png" alt="Date" className="w-5 h-5" />
                <h1 className="text-md font-semibold">Weekly Schedule</h1>
              </span>
              <div className="flex items-center justify-between w-full bg-yellow-500 text-black font-semibold rounded-md px-3 py-1">
                <button 
                  onClick={handlePrevWeek} 
                  className="text-lg font-bold hover:scale-110 transition-transform"
                  aria-label="Previous week"
                >
                  {`<`}
                </button>
                <span className="text-sm">{weekDisplay}</span>
                <button 
                  onClick={handleNextWeek} 
                  className="text-lg font-bold hover:scale-110 transition-transform"
                  aria-label="Next week"
                >
                  {`>`}
                </button>
              </div>
            </div>
            <Table columns={columns} data={tableData} />
          </div>
        </Card>

        {/* My Time Logs Card - Today Only */}
        <Card radius="none" className="w-full">
          <div className="flex flex-col w-full">
            <span className="flex flex-row space-x-3 w-full items-center mb-3">
              <img src="../img/User_Clock_Icon.png" alt="Clock" className="w-5 h-5" />
              <h1 className="text-md font-semibold">My Time Logs</h1>
            </span>
            
            <div className="mb-3 px-3 py-2 bg-blue-50 border border-blue-200 rounded-md">
              <p className="text-xs text-blue-700 font-medium">
                📅 Today: {format(new Date(), "MMM dd, yyyy")}
              </p>
            </div>

            {timeLogsLoading ? (
              <div className="text-center py-4 text-gray-500 text-sm">Loading...</div>
            ) : (
              <>
                <div className="grid grid-cols-2 w-full gap-y-4 gap-x-4 text-sm">
                  <label className="text-gray-700 text-left font-medium">Clock In</label>
                  <p className="font-bold text-gray-900 text-right">
                    {timeLogs.clock_in ? (
                      <span className="px-3 py-1 bg-green-100 text-green-700 rounded-lg text-xs font-semibold">
                        {timeLogs.clock_in}
                      </span>
                    ) : (
                      <span className="text-gray-400 text-xs">--:-- --</span>
                    )}
                  </p>
                  
                  <label className="text-gray-700 text-left font-medium">Clock Out</label>
                  <p className="font-bold text-gray-900 text-right">
                    {timeLogs.clock_out ? (
                      <span className="px-3 py-1 bg-red-100 text-red-700 rounded-lg text-xs font-semibold">
                        {timeLogs.clock_out}
                      </span>
                    ) : (
                      <span className="px-3 py-1 bg-yellow-100 text-yellow-700 rounded-lg text-xs font-semibold">
                        In Progress
                      </span>
                    )}
                  </p>
                </div>
                
                <div className="mt-4 pt-3 border-t border-gray-200 flex justify-between items-center">
                  <span className="text-xs text-gray-500">Auto-updates every 30s</span>
                  <button 
                    onClick={() => {
                      refetchTimeLogs();
                      refetchAttendance();
                    }}
                    className="text-xs text-blue-600 hover:text-blue-800 font-medium transition-colors"
                    disabled={timeLogsLoading || attendanceLoading}
                  >
                    🔄 Refresh
                  </button>
                </div>
              </>
            )}
          </div>
        </Card>

        {/* Work Hours Summary Card */}
        <Card radius="none" className="w-full">
          <div className="flex flex-col h-full">
            <h1 className="font-semibold text-md mb-3">Work Hours Summary</h1>
            
            {attendanceLoading ? (
              <div className="text-center py-4 text-gray-500 text-sm">Loading...</div>
            ) : (
              <div className="space-y-4">
                {/* Weekly Hours */}
                <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg p-4 border border-blue-200">
                  <div className="flex items-center justify-between mb-2">
                    <h2 className="text-xs font-semibold text-blue-900 uppercase tracking-wide">
                      📅 This Week
                    </h2>
                    <span className="text-xs text-blue-600 font-medium">
                      {format(weekStart, "MMM dd")} - {format(weekEnd, "MMM dd")}
                    </span>
                  </div>
                  <div className="flex items-baseline justify-between">
                    <div>
                      <p className="text-3xl font-bold text-blue-700">
                        {weeklyHours.total}
                        <span className="text-lg text-blue-500 ml-1">hrs</span>
                      </p>
                      <p className="text-xs text-blue-600 mt-1">
                        {weeklyHours.days} {weeklyHours.days === 1 ? 'day' : 'days'} worked
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm text-blue-600 font-medium">
                        Avg: {weeklyHours.days > 0 ? (weeklyHours.total / weeklyHours.days).toFixed(1) : '0'} hrs/day
                      </p>
                    </div>
                  </div>
                </div>

                {/* Total Hours - All Time */}
                <div className="bg-gradient-to-br from-purple-50 to-purple-100 rounded-lg p-4 border border-purple-200">
                  <div className="flex items-center justify-between mb-2">
                    <h2 className="text-xs font-semibold text-purple-900 uppercase tracking-wide">
                      🏆 Total Hours
                    </h2>
                    <span className="text-xs text-purple-600 font-medium">
                      All Time
                    </span>
                  </div>
                  <div className="flex items-baseline justify-between">
                    <div>
                      <p className="text-3xl font-bold text-purple-700">
                        {totalHours.total}
                        <span className="text-lg text-purple-500 ml-1">hrs</span>
                      </p>
                      <p className="text-xs text-purple-600 mt-1">
                        {totalHours.days} {totalHours.days === 1 ? 'day' : 'days'} total
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm text-purple-600 font-medium">
                        Avg: {totalHours.days > 0 ? (totalHours.total / totalHours.days).toFixed(1) : '0'} hrs/day
                      </p>
                    </div>
                  </div>
                </div>

                {/* Quick Stats */}
                <div className="grid grid-cols-2 gap-2">
                  <div className="bg-green-50 rounded-lg p-3 border border-green-200">
                    <p className="text-xs text-green-600 font-medium mb-1">Today's Status</p>
                    <p className="text-lg font-bold text-green-700">
                      {timeLogs.clock_in && !timeLogs.clock_out ? '🟢 Working' : 
                       timeLogs.clock_in && timeLogs.clock_out ? '✅ Complete' : 
                       '⚪ Not Started'}
                    </p>
                  </div>
                  <div className="bg-orange-50 rounded-lg p-3 border border-orange-200">
                    <p className="text-xs text-orange-600 font-medium mb-1">This Month</p>
                    <p className="text-lg font-bold text-orange-700">
                      {thisMonthHours} hrs
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}

export default EmployeeDashboard;