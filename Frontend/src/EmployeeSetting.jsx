// EmployeeSettings.jsx - Updated version
import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import Cookies from "js-cookie";
import ChangePasswordModal from "./component/modals/ChangePasswordModal";
import ConfirmModal from "./component/modals/ConfirmModal";
import MessageModal from "./component/modals/MessageModal";

function EmployeeSetting() {
  const navigate = useNavigate();
  const employeeId = localStorage.getItem("employeeId");

  const [showChangePassword, setShowChangePassword] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [messageOpen, setMessageOpen] = useState(false);
  const [messageText, setMessageText] = useState("");

  // Notifications toggle
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  
  // ✅ NEW: Availability toggle for full-time employees
  const [availabilityEnabled, setAvailabilityEnabled] = useState(true);
  const [isFullTime, setIsFullTime] = useState(false);

  useEffect(() => {
    // Fetch employee details to check if full-time
    fetchEmployeeDetails();
    
    // Load notification preference
    const savedNotif = localStorage.getItem("employee_notifications");
    if (savedNotif) setNotificationsEnabled(savedNotif === "on");
  }, []);

  const fetchEmployeeDetails = async () => {
    try {
      const res = await fetch(`http://192.168.1.9:3001/api/employee/${employeeId}`);
      const data = await res.json();
      
      if (data.employment_type === 'Full-Time') {
        setIsFullTime(true);
        // Load availability preference from database
        setAvailabilityEnabled(!data.availability_disabled);
      }
    } catch (err) {
      console.error('Error fetching employee details:', err);
    }
  };

  const toggleAvailability = async (newValue) => {
    try {
      const res = await fetch(`http://192.168.1.9:3001/api/employee/${employeeId}/availability`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          availability_disabled: !newValue 
        })
      });

      const data = await res.json();
      if (data.success) {
        setAvailabilityEnabled(newValue);
        setMessageText(
          newValue 
            ? "✅ You will be included in automatic scheduling" 
            : "⚠️ You will be excluded from automatic scheduling"
        );
        setMessageOpen(true);
      }
    } catch (err) {
      console.error('Error updating availability:', err);
      setMessageText("❌ Failed to update availability setting");
      setMessageOpen(true);
    }
  };

  const settings = [
    {
      label: "Change Password",
      icon: "../img/ProfileLock.png",
      action: () => setShowChangePassword(true),
    },
    {
      label: "Notifications",
      icon: "../img/notification.png",
      action: null,
      render: () => (
        <div className="flex items-center gap-2">
          <div
            onClick={() => {
              setNotificationsEnabled(!notificationsEnabled);
              localStorage.setItem("employee_notifications", !notificationsEnabled ? "on" : "off");
            }}
            className={`w-16 h-8 flex items-center rounded-full p-1 cursor-pointer transition-colors ${
              notificationsEnabled ? "bg-green-400" : "bg-gray-300"
            }`}
          >
            <div
              className={`bg-white w-6 h-6 rounded-full shadow-md transform transition-transform ${
                notificationsEnabled ? "translate-x-8" : "translate-x-0"
              } flex items-center justify-center text-xs font-bold`}
            >
              {notificationsEnabled ? "ON" : "OFF"}
            </div>
          </div>
        </div>
      ),
    },
    // ✅ NEW: Auto-Scheduling toggle (only for full-time)
    ...(isFullTime ? [{
      label: "Auto-Scheduling",
      icon: "../img/calendar.png",
      action: null,
      render: () => (
        <div className="flex items-center gap-2">
          <div
            onClick={() => toggleAvailability(!availabilityEnabled)}
            className={`w-16 h-8 flex items-center rounded-full p-1 cursor-pointer transition-colors ${
              availabilityEnabled ? "bg-green-400" : "bg-gray-300"
            }`}
          >
            <div
              className={`bg-white w-6 h-6 rounded-full shadow-md transform transition-transform ${
                availabilityEnabled ? "translate-x-8" : "translate-x-0"
              } flex items-center justify-center text-xs font-bold`}
            >
              {availabilityEnabled ? "ON" : "OFF"}
            </div>
          </div>
        </div>
      ),
    }] : []),
    {
      label: "Certificate of Employee",
      action: () => navigate("/employee/certificate"),
    },
  ];

  const handleChangePasswordSubmit = async ({ oldPassword, newPassword }) => {
    const token = Cookies.get("employee_token");
    if (!token) {
      navigate("/login");
      return;
    }

    setConfirmOpen(true);

    const confirm = await new Promise((resolve) => {
      const interval = setInterval(() => {
        if (window.__confirmResult !== undefined) {
          clearInterval(interval);
          const result = window.__confirmResult;
          window.__confirmResult = undefined;
          resolve(result);
        }
      }, 100);
    });

    if (!confirm) return;

    try {
      const res = await fetch("http://192.168.1.9:3001/api/employee/change-password", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ oldPassword, newPassword }),
      });

      const data = await res.json();

      if (data.success) {
        setShowChangePassword(false);
        localStorage.removeItem("isFirstLogin");
        setMessageText("✅ Password changed successfully!");
        setMessageOpen(true);
      } else {
        setMessageText(data.error || "❌ Failed to change password.");
        setMessageOpen(true);
      }
    } catch (err) {
      setMessageText("⚠️ Server error. Please try again.");
      setMessageOpen(true);
    }
  };

  return (
    <div className="font-inter text-black flex flex-col">
      <div className="flex items-center gap-2 py-2 px-1 cursor-pointer text-sm">
        <span onClick={() => navigate(-1)} className="text-xl">&#60;</span>
        <p className="font-medium">Settings</p>
      </div>

      <div className="flex flex-col align-center gap-2 mx-3 mt-3 bg-[#FFC629] shadow-[10px_10px_0_#111827]">
        <div className="border-b-2 mt-3 px-4 py-4 flex items-center gap-3">
          <img src="../img/Profile.png" alt="Profile" className="w-10 rounded-full bg-white h-10" />
          <div>
            <p className="font-semibold">Ryan</p>
            <p className="text-sm opacity-80">{isFullTime ? 'Full-Time' : 'Part-Time'}</p>
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
            {item.render ? item.render() : <span className="text-lg">&#62;</span>}
          </div>
        ))}

        {/* ✅ NEW: Info text about auto-scheduling */}
        {isFullTime && (
          <div className="px-4 py-3 bg-yellow-300 text-xs">
            <p className="font-medium">ℹ️ About Auto-Scheduling:</p>
            <p className="mt-1">When ON, you'll be automatically included in weekly schedules. Turn OFF if you need to be temporarily excluded from scheduling.</p>
          </div>
        )}

        <div>
          <p className="flex items-center text-center justify-center align-center text-sm opacity-70 py-4">
            The Crunch BS - Version 1.0
          </p>
        </div>
      </div>

      {showChangePassword && (
        <ChangePasswordModal
          isOpen={showChangePassword}
          onClose={() => {
            setShowChangePassword(false);
            localStorage.removeItem("isFirstLogin");
          }}
          onSubmit={handleChangePasswordSubmit}
        />
      )}

      <ConfirmModal
        isOpen={confirmOpen}
        title="Confirm Password Change"
        message="Are you sure you want to change your password?"
        onConfirm={() => { window.__confirmResult = true; setConfirmOpen(false); }}
        onCancel={() => { window.__confirmResult = false; setConfirmOpen(false); }}
      />

      <MessageModal
        isOpen={messageOpen}
        message={messageText}
        onClose={() => setMessageOpen(false)}
      />
    </div>
  );
}

export default EmployeeSetting;