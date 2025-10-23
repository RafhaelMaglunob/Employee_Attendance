export default function EmployeeMore() {
  const items = ["Profile", "Settings", "Help & Support", "Logout"];

  return (
    <div className="flex flex-col items-center gap-4">
      {items.map((item, i) => (
        <div
          key={i}
          className="bg-[#FFC629] shadow-[6px_6px_0px_#5E451D] rounded-2xl p-6 w-full max-w-md text-[#5E451D] font-semibold text-center"
        >
          {item}
        </div>
      ))}
    </div>
  );
}
