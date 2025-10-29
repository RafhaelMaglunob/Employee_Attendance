import React from "react";
import { useNavigate } from "react-router-dom";

function EmployeeSetting() {
  const navigate = useNavigate();

  const settings = [
    {
      label: "Change Password",
      icon: "../img/ProfileLock.png",
      action: () => navigate("/employee/change-password")
    },
    {
      label: "Notifications",
      icon: "../img/notification.png",
      action: () => navigate("/employee/notifications")
    },
    {
      label: "Certificate of Employee",
      action: () => navigate("/employee/certificate")
    }
  ];

  return (
    <div className="font-inter text-black flex flex-col">

      {/* Back + Title */}
      <div className="flex items-center gap-2 py-2 px-1 cursor-pointer text-sm">
        <span onClick={() => navigate(-1)} className="text-xl">&#60;</span>
        <p className="font-medium">Settings</p>
      </div>


      {/* Setting Options */}
      <div className="flex flex-col align-center gap-2 mx-3 mt-3 bg-[#FFC629] shadow-[10px_10px_0_#111827] ">
        <div className="border-b-2 mt-3 px-4 py-4 flex items-center gap-3">
          <img src="../img/Profile.png" alt="Profile" className="w-10 rounded-[50px] bg-white h-10" />
          <div>
            <p className="font-semibold">Ryan</p>
            <p className="text-sm opacity-80">Part-timer</p>
          </div>
        </div>
        {settings.map((item, i) => (
          <div
            key={i}
            onClick={item.action}
            className="px-4 py-4 border-b flex justify-between items-center pt-2 cursor-pointer"
          >
            <div className="flex items-center gap-3">
              {item.icon && <img src={item.icon} alt={item.label} className="w-4 h-4 md:w-6 md:h-6" />}
              <p className={`text-sm font-medium ${!item.icon ? "px-9" : ""}`}>{item.label}</p>
            </div>

            {/* Right side (value or >) */}
            {item.value ? (
              <p className="text-sm opacity-80">{item.value}</p>
            ) : (
              <span className="text-lg">&#62;</span>
            )}
          </div>
        ))}
        <div>
          <p className="flex items-center text-center justify-center align-center text-sm opacity-70 py-4"> The Crunch BS - Version 1.0 </p>
        </div>
      </div>
    </div>
  );
}

export default EmployeeSetting;
