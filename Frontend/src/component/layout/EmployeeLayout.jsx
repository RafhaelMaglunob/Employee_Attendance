import { useEffect, useState } from "react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import Cookies from "js-cookie";
import Background from "../ui/Background";
import Navbar from "./Navbar";

export default function EmployeeLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const [activeTab, setActiveTab] = useState("home");

  const handleLogout = () => {
    Cookies.remove("auth_token");
    navigate("/employee-login", { replace: true });
  };

  useEffect(() => {
    if (location.pathname.includes("dashboard")) setActiveTab("home");
    else if (location.pathname.includes("requests")) setActiveTab("requests");
    else if (location.pathname.includes("notifications")) setActiveTab("notifications");
    else if (location.pathname.includes("more")) setActiveTab("more");
  }, [location.pathname]);

  const getTitle = () => {
    switch (activeTab) {
      case "home": return "Home";
      case "requests": return "Requests";
      case "notifications": return "Notifications";
      case "more": return "More";
      default: return "Home";
    }
  };

  return (
    <div className="relative w-full h-screen overflow-hidden flex flex-col">
      <Background />

      {/* HEADER */}
      <header className="bg-[#FFC629] flex items-center justify-between px-4 py-2 border-b-4 border-[#5E451D] fixed top-0 w-full z-20">
        {/* Logo */}
        <img
          src="../img/TheCrunchLogoMnoBG 1.png"
          alt="Logo"
          className="w-10 h-10 object-contain"
        />

        {/* Page Title */}
        <h1 className="text-[#5E451D] font-bold text-lg">{getTitle()}</h1>

        {/* User Icon with Logout */}
        <button
          onClick={handleLogout}
          className="w-7 h-7 flex items-center justify-center rounded-full bg-[#5E451D] text-[#FFC629] font-bold"
          title="Logout"
        >
          ⎋
        </button>
      </header>

      {/* MAIN CONTENT */}
      <main className="flex-1 overflow-y-auto pt-[70px] pb-[70px] p-4 relative z-10">
        <Outlet />
      </main>

      {/* NAVBAR */}
      <Navbar activeTab={activeTab} setActiveTab={setActiveTab} />
    </div>
  );
}
