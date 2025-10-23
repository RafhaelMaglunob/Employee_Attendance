import { useNavigate } from "react-router-dom";

export default function Navbar({ activeTab, setActiveTab }) {
  const navigate = useNavigate();

  const tabs = [
    { id: "home", label: "Home", icon: "🏠", path: "/employee/dashboard" },
    { id: "requests", label: "Requests", icon: "📄", path: "/employee/requests" },
    { id: "notifications", label: "Notifications", icon: "🔔", path: "/employee/notifications" },
    { id: "more", label: "More", icon: "☰", path: "/employee/more" },
  ];

  const handleTabClick = (tab) => {
    setActiveTab(tab.id);
    navigate(tab.path);
  };

  return (
    <nav className="bg-black fixed bottom-0 left-0 w-full flex justify-around items-center py-2 border-t border-[#5E451D] z-20">
      {tabs.map((tab) => {
        const isActive = activeTab === tab.id;
        return (
          <button
            key={tab.id}
            onClick={() => handleTabClick(tab)}
            className="flex flex-col items-center space-y-1 focus:outline-none"
          >
            <div
              className={`text-xl ${
                isActive ? "text-[#FFC629]" : "text-white"
              } transition-colors`}
            >
              {tab.icon}
            </div>
            <span
              className={`text-xs ${
                isActive ? "text-[#FFC629]" : "text-white"
              }`}
            >
              {tab.label}
            </span>
          </button>
        );
      })}
    </nav>
  );
}
