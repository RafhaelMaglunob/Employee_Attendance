export default function EmployeeDashboard() {
  return (
    <div className="flex flex-col items-center gap-4">
      <div className="bg-[#FFC629] shadow-[6px_6px_0px_#5E451D] rounded-2xl p-6 w-full max-w-md text-[#5E451D] text-center font-semibold">
        Welcome back 👋
      </div>

      <div className="bg-[#FFC629] shadow-[6px_6px_0px_#5E451D] rounded-2xl p-6 w-full max-w-md text-[#5E451D] text-center font-semibold">
        Attendance Summary
      </div>

      <div className="bg-[#FFC629] shadow-[6px_6px_0px_#5E451D] rounded-2xl p-6 w-full max-w-md text-[#5E451D] text-center font-semibold">
        Upcoming Schedule
      </div>
    </div>
  );
}
