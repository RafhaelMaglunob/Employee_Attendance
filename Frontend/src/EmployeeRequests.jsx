export default function EmployeeRequests() {
  return (
    <div className="flex flex-col items-center gap-4">
      <div className="bg-[#FFC629] shadow-[6px_6px_0px_#5E451D] rounded-2xl p-6 w-full max-w-md text-[#5E451D] text-center font-semibold">
        Leave Request
      </div>

      <div className="bg-[#FFC629] shadow-[6px_6px_0px_#5E451D] rounded-2xl p-6 w-full max-w-md text-[#5E451D] text-center font-semibold">
        Overtime Request
      </div>

      <div className="bg-[#FFC629] shadow-[6px_6px_0px_#5E451D] rounded-2xl p-6 w-full max-w-md text-[#5E451D] text-center font-semibold">
        Schedule Adjustment
      </div>
    </div>
  );
}
