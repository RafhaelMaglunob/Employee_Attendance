import React, { useState } from "react";
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
  const employeeId = localStorage.getItem("employeeId");
  const [currentWeek, setCurrentWeek] = useState(new Date());

  // Weekly Summary data
  const [hoursWorked, setHoursWorked] = useState(32);
  const totalHours = 40;
  const percentage = Math.min((hoursWorked / totalHours) * 100, 100);

  const weekStart = startOfWeek(currentWeek, { weekStartsOn: 1 }); // Monday start
  const weekEnd = endOfWeek(currentWeek, { weekStartsOn: 1 });
  const weekDisplay =
    format(weekStart, "MMM") === format(weekEnd, "MMM")
      ? `${format(weekStart, "MMM d")} - ${format(weekEnd, "d")}`
      : `${format(weekStart, "MMM d")} - ${format(weekEnd, "MMM d")}`;
  const handlePrevWeek = () => setCurrentWeek(subWeeks(currentWeek, 1));
  const handleNextWeek = () => setCurrentWeek(addWeeks(currentWeek, 1));

  // Fetch employee schedule
  const { data: scheduleData = [] } = useFetchData(
    `http://localhost:3001/api/employee/schedule/${employeeId}`,
    (res) => res
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

    // Classify shifts
    let morningShiftData = null;
    let eveningShiftData = null;

    daySchedules.forEach((shift) => {
      const startHour = parse(shift.start_time, "HH:mm:ss", new Date()).getHours();

      if (startHour >= 7 && startHour <= 13) {
        morningShiftData = shift;
      } else if (startHour >= 15 && startHour <= 20) {
        eveningShiftData = shift;
      }
    });

    const morningShift = morningShiftData ? (
      <div className="flex flex-col">
        <span className="whitespace-nowrap">
          {`${formatTime(morningShiftData.start_time)} - ${formatTime(morningShiftData.end_time)}`}
        </span>
        {morningShiftData.task && <span>({morningShiftData.task})</span>}
      </div>
    ) : "-";

    const eveningShift = eveningShiftData ? (
      <div className="flex flex-col">
        <span className="whitespace-nowrap">
          {`${formatTime(eveningShiftData.start_time)} - ${formatTime(eveningShiftData.end_time)}`}
        </span>
        {eveningShiftData.task && <span>({eveningShiftData.task})</span>}
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
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Weekly Schedule Card */}
        <Card radius="none" className="w-full">
          <div className="flex flex-col">
            <div className="flex flex-row justify-between w-full space-y-3">
              <span className="flex flex-row space-x-3 w-full items-center">
                <img src="../img/Date_Icon.png" alt="Date" className="w-5 h-5" />
                <h1 className="text-md font-semibold">Weekly Schedule</h1>
              </span>
              <div className="flex items-center justify-between w-full bg-yellow-500 text-black font-semibold rounded-md px-3 py-1 mb-2">
                <button onClick={handlePrevWeek} className="text-lg font-bold">{`<`}</button>
                <span>{weekDisplay}</span>
                <button onClick={handleNextWeek} className="text-lg font-bold">{`>`}</button>
              </div>
            </div>

            <Table columns={columns} data={tableData} />
          </div>
        </Card>

        {/* My Time Logs Card */}
        <Card radius="none" className="w-full">
          <div className="flex flex-col w-full">
            <span className="flex flex-row space-x-3 w-full items-center mb-2">
              <img src="../img/User_Clock_Icon.png" alt="Clock" className="w-5 h-5" />
              <h1 className="text-md font-semibold">My Time Logs</h1>
            </span>
            <div className="grid grid-cols-2 w-full gap-y-3 gap-x-4 text-sm">
              <label className="text-gray-700 text-left">Clock In</label>
              <p className="font-semibold text-gray-900 text-right">08:30 AM</p>
              <label className="text-gray-700 text-left">Break Start</label>
              <p className="font-semibold text-gray-900 text-right">12:00 PM</p>
              <label className="text-gray-700 text-left">Break End</label>
              <p className="font-semibold text-gray-900 text-right">01:00 PM</p>
              <label className="text-gray-700 text-left">Clock Out</label>
              <p className="font-semibold text-gray-900 text-right">05:30 PM</p>
            </div>
          </div>
        </Card>

        {/* Weekly Summary Card */}
        <Card radius="none" className="w-full">
          <div className="flex flex-col h-full">
            <h1 className="font-semibold text-md mb-3">Weekly Summary</h1>
            <div className="mb-2 flex flex-row w-full justify-between">
              <label className="text-xs">Hours Worked</label>
              <p className="text-xs font-semibold">{hoursWorked}h / {totalHours}h</p>
            </div>
            <div className="w-full h-3 rounded-2xl bg-[#5E451D]">
              <div
                className="h-3 rounded-2xl bg-red-500 transition-all duration-300"
                style={{ width: `${percentage}%` }}
              ></div>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}

export default EmployeeDashboard;
