import { Outlet } from "react-router-dom";
import Cookies from "js-cookie";

export default function EmployeeLayout() {
    const handleLogout = () => {
        Cookies.remove("auth_token");
        window.location.href = "/employee-login";
    };

    return (
        <div className="min-h-screen flex flex-col">
            <NavBar
                className="flex sticky top-0 z-40 items-center border-b-8 border-b-[#5E451D]"
                variant={userRole}
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
                    <Headers onLogout={handleLogout}/>
                    </div>
                </div>
            </NavBar>
        </div>
    );
}
