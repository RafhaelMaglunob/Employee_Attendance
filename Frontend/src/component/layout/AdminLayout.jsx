// component/layout/AdminLayout.jsx
import React, { useState, useEffect } from "react";
import { Outlet, Link, useNavigate, useLocation } from "react-router-dom";
import { Sidebar } from "./Container.jsx";
import { NavBar } from "./NavBar.jsx";
import Headers from "../ui/header.jsx";
import { Button } from "../ui/button.jsx";
import Cookies from "js-cookie";

const sidebar = [
  {name: "Dashboard", src: "../img/Dashboard_Icon.png", alt:"Dashboard Icon", path: "dashboard"},
  {name: "Employees", src: "../img/Employees_Icon.png", alt:"Employees Icon", path: "employees"},
  {name: "Auditing", src: "../img/Auditing_Icon.png", alt:"Auditing Icon", path: "audit"},
  {name: "Salary", src: "../img/Salary_Icon.png", alt:"Salary Icon", path: "salary"},
  {name: "Incidents", src: "../img/Incidents_Icon.png", alt:"Incidents Icon", path: "incident"},
  // {name: "Reports", src: "../img/Reports_Icon.png", alt:"Reports Icon", path: "report"},
  {name: "Scheduling", src: "../img/Schedule_Icon.png", alt:"Schedule Icon", path: "schedule"},
  {name: "Attendance", src: "../img/Attendance_Icon.png", alt:"Attendance Icon", path: "attendance"},
  {name: "Approvals", src: "../img/Approval_Icon.png", alt:"Approvals Icon", path: "approval"},
];


export default function AdminLayout() {
  const userRole = localStorage.getItem("userRole")?.toLowerCase();
  const userEmail = localStorage.getItem("userEmail")?.toLowerCase();
  const navigate = useNavigate();
  
  const location = useLocation();
  const currentPath = location.pathname.split("/")[1] || "dashboard";
  const [path, setPath] = useState(currentPath);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const Admin_buttonPath = ["Dashboard", "Employees", "Auditing", "Salary", "Incidents", "Reports", "Approvals"]
  const HR_buttonPath = ["Dashboard", "Employees", "Auditing", "Salary", "Incidents", "Reports", "Approvals"]
  const HeadStaff_buttonPath = ["Dashboard","Scheduling", "Attendance"];

  const filteredSidebar = sidebar.filter(item => {
    if (userRole === "admin") {
      return Admin_buttonPath.includes(item.name);
    }
    if (userRole === "hr") {
      return HR_buttonPath.includes(item.name);
    }
    if (userRole === "headstaff") {
      return HeadStaff_buttonPath.includes(item.name);
    }
    return true;
  });

  useEffect(() => {
    setPath(currentPath);
    localStorage.setItem("buttonPath", currentPath);
  }, [currentPath]);

  const handleLogout = async () => {
    Cookies.remove("auth_token");
    localStorage.removeItem("buttonPath");
    localStorage.removeItem("userRole");
    localStorage.removeItem("userEmail");
    localStorage.removeItem("employeeSortTable");
    localStorage.removeItem("employeeTab");
    navigate("/login", { replace: true });
  };


  return (
    <>
      <div className="flex overflow-x-hidden w-full relative">
        <Sidebar
          role={userRole}
          className={`fixed sm:sticky top-0 left-0 flex flex-col bg-[#FFC629] font-inter
            z-40 transform transition-transform duration-300
            w-56 sm:w-64
            ${sidebarOpen ? "translate-x-0" : "-translate-x-full"} 
            sm:translate-x-0 sm:flex flex-col items-start space-y-1 overflow-y-auto`}
        >
          <div className="flex items-center justify-between w-full">
            <img src="..\img\TheCrunchLogoSnoBG 1.png" className="flex mt-[-10px] ml-[-10px] mb-3" />
            <button
              className={`${sidebarOpen ? "flex" : "hidden"} flex sm:hidden text-xl p-1 mt-[-20px]`}
              onClick={() => setSidebarOpen(!sidebarOpen)}
            >
              X
            </button>
          </div>

          {filteredSidebar.map((item, index) => (
            <Link key={index} to={`/${item.path}`} className="w-full">
              <Button
                onClick={() => setPath(item.path)}
                className={`flex items-center justify-start py-2 space-x-2 px-4 ${
                  path === item.path ? "bg-white/60" : ""
                } rounded-xl w-full`}
              >
                <img
                  src={item.src}
                  alt={item.alt}
                  className={`${userRole === "admin" ? "brightness-1000" : ""}`}
                />
                <p>{item.name}</p>
              </Button>
            </Link>
          ))}
        </Sidebar>

        <div className="flex-1 flex flex-col w-full">
          <NavBar
            className="flex sticky top-0 z-40 items-center border-b-8 border-b-[#5E451D]"
            variant={"default"}
          >
            <button className="flex md:hidden ml-4" onClick={() => setSidebarOpen(!sidebarOpen)}>
              <svg
                className="h-6 w-6 text-gray-700"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M4 6h16M4 12h16M4 18h16"
                />
              </svg>
            </button>

            <div className="flex flex-row justify-between w-full mr-10 space-x-4 relative">
              <img src="../img/TheCrunchLogoMnoBG 1.png" className="w-auto object-contain" />
              <div className="flex flex-row items-center space-x-2 relative">
                <img src="../img/Notification.png" alt="Notification Icon" className="w-5 h-5" />
                <Headers userRole={userRole} userEmail={userEmail} onLogout={handleLogout} addSVG>
                  <div className="border-2 rounded-[50px]">
                    <img
                      src="../img/Profile.png"
                      alt="Profile Icon"
                      className="w-7 h-7 rounded-full"
                    />
                  </div>
                  
                </Headers>
              </div>
            </div>
          </NavBar>

          <div className="flex-1 sm:border-l-8 sm:border-l-[#5E451D] px-3 py-1">
            <Outlet /> {/* This is where pages like Dashboard, Employees, etc. appear */}
          </div>
        </div>
      </div>
    </>
  );
}
