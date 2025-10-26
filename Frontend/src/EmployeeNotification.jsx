import { useOutletContext, useNavigate } from "react-router-dom";
import { useState } from "react";

function EmployeeNotification() {
    const { setPath, setCurrentPath } = useOutletContext();
    const [isScheduleOpen, setIsScheduleOpen] = useState(false);
    const navigate = useNavigate();

    const handleSchedule = () => {
        setIsScheduleOpen(true);
        setPath("Weekly Shift");
        setCurrentPath("/employee/weekly-shift");
        localStorage.setItem("employeePath", "Weekly Shift");
        localStorage.setItem("employeeButtonPath", "/employee/weekly-shift");
        navigate("/employee/weekly-shift");
    };

    return (
        <div>
            <div className="flex flex-row gap-4 border-l-6 rounded-md border-[#5E451D] px-3 py-4 bg-[#FFF1C8]">
                <img src="../img/Notification.png" alt="Notification" className="w-7 h-8" />
                <div>
                    <p className="font-inter text-[#5E451D]">
                        <span className="text-lg font-semibold block">Set Availability for next week</span>
                        <span className="text-md block">
                            Part-time staff: Please submit your availability for next week by Friday
                        </span>
                    </p>
                    <button
                        onClick={handleSchedule}
                        className="bg-[#5E451D] text-white py-1 px-4 rounded-[50px] mt-2"
                    >
                        Set Now
                    </button>
                </div>
            </div>
            {isScheduleOpen && (
                <div className="mt-4 p-4 border rounded-md border-gray-300 bg-white">
                    <p>Schedule Modal Open!</p>
                </div>
            )}
        </div>
    );
}

export default EmployeeNotification;
