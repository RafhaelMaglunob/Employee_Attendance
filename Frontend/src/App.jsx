import { BrowserRouter as Router, Routes, Route, Link } from 'react-router-dom';
import { useState } from 'react'

import './App.css'

import Dashboard from './Dashboard.jsx'
import Employees from './Employees.jsx'
import Scheduling from './Scheduling.jsx'
import Attendance from './Attendance.jsx'
import Approval from './Approval.jsx'

import { Button } from './component/ui/button.jsx'
import { Sidebar } from './component/layout/Container.jsx'
import { NavBar } from './component/layout/NavBar.jsx'


const sidebar = [
  //Admin HR
  {name: "Dashboard", src: "../img/Dashboard_Icon.png", alt:"Dashboard Icon", path: "dashboard"},
  {name: "Employees", src: "../img/Employees_Icon.png", alt:"Employees Icon", path: "employee"},
  {name: "Auditing", src: "../img/Auditing_Icon.png", alt:"Auditing Icon", path: "audit"},
  {name: "Salary", src: "../img/Salary_Icon.png", alt:"Salary Icon", path: "Salary"},
  {name: "Incidents", src: "../img/Incidents_Icon.png", alt:"Incidents Icon", path: "incident"},
  {name: "Reports", src: "../img/Reports_Icon.png", alt:"Reports Icon", path: "report"},

  //HR
  {name: "Scheduling", src: "../img/Schedule_Icon.png", alt:"Schedule Icon", path: "schedule"},
  {name: "Attendance", src: "../img/Attendance_Icon.png", alt:"Attendance Icon", path: "attendance"},
  {name: "Approvals", src: "../img/Approval_Icon.png", alt:"Approvals Icon", path: "approval"},

]

function App() {
  const userRole = "hr"
  const [sidebarOpen, setSidebarOpen] = useState(false);
  return (
    <Router>
      <div className="flex">
        {/*Sidebar*/}
        <Sidebar
          className={`
            fixed sm:sticky top-0 left-0 flex flex-col bg-[#FFC629] font-inter
            h-screen z-40 transform transition-transform duration-300
            w-56 sm:w-64
            ${sidebarOpen ? "translate-x-0" : "-translate-x-full"} 
            sm:translate-x-0 sm:flex flex-col items-start space-y-1 overflow-y-auto
          `}
        >

          <div className="flex items-center justify-between w-full">
            <img src="..\img\TheCrunchLogoSnoBG 1.png" className="flex mt-[-10px] ml-[-10px] mb-3"></img>
            <button 
              className={`${sidebarOpen ? "flex" : "hidden"} flex sm:hidden text-xl p-1 font-center mt-[-20px]`}
              onClick={() => setSidebarOpen(!sidebarOpen)}
            >
              X
            </button>
          </div>
          {sidebar.map((item, index) => (
            <Link 
              key={index} 
              to={`/${item.path}`} 
              className="w-full"
            >
              <Button 
                className="flex items-center justify-start py-2 space-x-2 px-4"
              >
                <img src={item.src} alt={item.alt}></img>
                <p>{item.name}</p>
              </Button>
            </Link>
          ))}
        </Sidebar>

        <div className="flex-1 flex flex-col w-full">
          <NavBar className="flex sticky top-0 z-40 items-center border-b-8 border-b-[#5E451D]" variant={userRole}>
            <button 
              className="flex md:hidden ml-4"
              onClick={() => setSidebarOpen(!sidebarOpen)}
            >
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
            <img src="..\img\TheCrunchLogoMnoBG 1.png" className="w-auto object-contain"></img>
          </NavBar>
          
          <div className="flex-1 sm:border-l-8 sm:border-l-[#5E451D] border-r-0 border-b-0 px-3 py-1">
              <Routes>
                <Route path="/dashboard" element={<Dashboard />} />
                <Route path="/employee" element={<Employees />} />
                <Route path="/schedule" element={<Scheduling />} />
                <Route path="/attendance" element={<Attendance />} />
                <Route path="/approval" element={<Approval />} />
              </Routes>
          </div>
        </div>
      </div>
    </Router>
  )
}

export default App
