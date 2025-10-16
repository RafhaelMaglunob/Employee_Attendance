import { Outlet } from "react-router-dom";
import Cookies from "js-cookie";

export default function EmployeeLayout() {
    const handleLogout = () => {
        Cookies.remove("auth_token");
        window.location.href = "/employee-login";
    };

    return (
        <div className="min-h-screen flex flex-col">
            <header className="flex justify-between items-center p-4 bg-yellow-400 border-b-2 border-yellow-600">
                <h1>TheCrunch Employee</h1>
                <button onClick={handleLogout}>Logout</button>
            </header>

            <main className="flex-1 p-4">
                <Outlet /> {/* Nested routes will render here */}
            </main>
        </div>
    );
}
