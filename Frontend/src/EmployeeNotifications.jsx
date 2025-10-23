export default function EmployeeNotifications() {
  const notifications = [
    "Your leave request has been approved.",
    "You have an upcoming schedule on Monday.",
    "New company memo: Office maintenance this Friday.",
  ];

  return (
    <div className="flex flex-col gap-4">
      {notifications.map((msg, i) => (
        <div
          key={i}
          className="bg-[#FFC629] shadow-[6px_6px_0px_#5E451D] rounded-2xl p-4 text-[#5E451D]"
        >
          {msg}
        </div>
      ))}
    </div>
  );
}
