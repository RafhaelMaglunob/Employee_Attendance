import React from "react";
import { useNavigate, useOutletContext } from "react-router-dom";

function EmployeeDetails() {
    const { setPath, setCurrentPath, handleLogout } = useOutletContext();
    const navigate = useNavigate();
    
    const handleDocuments = () => {
        setPath("Documents");
        setCurrentPath("/employee/document");
        localStorage.setItem("employeePath", "Documents");
        localStorage.setItem("employeeButtonPath", "/employee/document");
        navigate("/employee/document");
    };

    const handleIncident = () => {
        setPath("Incident Reports");
        setCurrentPath("/employee/incident-reports");
        localStorage.setItem("employeePath", "Incident Reports");
        localStorage.setItem("employeeButtonPath", "/employee/incident-reports");
        navigate("/employee/incident-reports");
    };

    const handleSettings = () => {
        setPath("Settings");
        setCurrentPath("/employee/setting");
        localStorage.setItem("employeePath", "Settings");
        localStorage.setItem("employeeButtonPath", "/employee/setting");
        navigate("/employee/setting");
    };

    return (
        <div className="bg-[#FFC629] flex flex-col shadow-[12px_12px_0_#111827] font-inter text-black">
            <div className="grid grid-cols-1 grid-rows-3 w-full divide-y">

                {/* Documents */}
                <div
                    onClick={handleDocuments}
                    className="flex items-center px-4 py-6 text-lg hover:bg-black/10 cursor-pointer gap-3 font-medium"
                >
                    <div className="rounded-[50px] bg-white p-2">
                        <img src="../img/Reports_Icon.png" alt="Reports" className="w-6 h-6 md:w-7 md:h-7 brightness-0" />
                    </div>
                    <p>Documents</p>
                </div>

                {/* Incident Reports */}
                <div
                    onClick={handleIncident}
                    className="flex items-center px-4 py-6 text-lg hover:bg-black/10 cursor-pointer gap-3 font-medium"
                >
                    <div className="rounded-[50px] bg-white p-2">
                        <img src="../img/EmployeeIncident_Icon.png" alt="Incident" className="w-6 h-6 md:w-7 md:h-7" />
                    </div>
                    <p>Incident Reports</p>
                </div>

                {/* Settings */}
                <div
                    onClick={handleSettings}
                    className="flex items-center px-4 py-6 text-lg hover:bg-black/10 cursor-pointer gap-3 font-medium"
                >
                    <div className="rounded-[50px] bg-white p-2">
                        <img src="../img/Settings_Icon.png" alt="Settings" className="w-6 h-6 md:w-7 md:h-7" />
                    </div>
                    <p>Settings</p>
                </div>

                <div
                    onClick={handleLogout}
                    className="flex items-center px-4 py-6 text-lg hover:bg-black/10 cursor-pointer gap-3 font-medium"
                >
                    <div className="rounded-[50px] bg-white p-2">
                        <img src="../img/Settings_Icon.png" alt="Settings" className="w-6 h-6 md:w-7 md:h-7" />
                    </div>
                    <p>Logout</p>
                </div>

            </div>
        </div>
    );
}

export default EmployeeDetails;
