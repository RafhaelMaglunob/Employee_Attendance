import React, { useState } from 'react';
import { Card } from './component/ui/card';
import Background from './component/ui/Background';
import { useNavigate } from 'react-router-dom';
import Cookies from "js-cookie";

function EmployeeLogin() {
    const navigate = useNavigate();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');

    const handleLogin = async () => {
        const res = await fetch("http://localhost:3001/api/employee-login", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email, password }),
        });

        const data = await res.json();

        if (!res.ok) {
            setError(data.error || "Login failed");
        } else {
            Cookies.set("employee_token", data.token || "", { expires: 1, sameSite: "Lax" });
            localStorage.setItem("employeeEmail", data.data.email);
            localStorage.setItem("employeeRole", data.data.role);
            localStorage.setItem("employeeId", data.data.employee_id);
            localStorage.setItem("isFirstLogin", data.data.must_change_password);
            navigate("/employee/dashboard", { replace: true });
        }
    };

    return (
        <div className="w-full pb-10 md:h-screen flex flex-col">
            <Background className="fixed inset-0 -z-10 pointer-events-none" />
            <div className="flex md:hidden flex-col items-center space-y-3 justify-center mt-3">
                <h1 className="text-3xl text-[#F59E0B] font-semibold">TheCrunch</h1>
                <p>Secure Login with Biometrics</p>
            </div>
            <div className="flex flex-1 flex-col md:flex-row items-center justify-center px-4 md:px-15 space-y-6 md:space-y-0 md:space-x-12">
                
                {/* Logo */}
                <div className="flex justify-center md:justify-start md:flex-1">
                    <img
                        src="../img/TheCrunchLogoChicken 1.png"
                        alt="The Crunch Logo"
                        className="w-75 h-75 md:w-150 md:h-150"
                    />
                </div>

                {/* Login Card */}
                <div className="w-full flex justify-center md:flex-1">
                    <Card className="w-full max-w-sm [&_*]:text-lg" radius="none">
                        <div className="flex flex-col space-y-3 px-4 py-4">
                            <h1 className="text-center font-bold text-2xl mb-3">Login with PIN</h1>

                            <label className="text-sm text-gray-700">Email</label>
                            <input
                                type="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                className="bg-white px-4 py-2 w-full rounded-sm border-2 focus:outline-blue-400 text-sm"
                            />

                            <label className="text-sm text-gray-700">PIN Password</label>
                            <input
                                type="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                className="bg-white px-4 py-2 w-full rounded-sm border-2 focus:outline-blue-400 text-sm"
                            />

                            <button
                                onClick={handleLogin}
                                className="bg-black text-white w-full py-4 text-xl font-bold rounded-md mt-3"
                            >
                                Login
                            </button>

                            {error && <p className="text-red-500 text-center mt-2">{error}</p>}
                            <div className="flex md:hidden flex-row space-x-4 justify-center items-center align-center [&_*]:text-[15px]">
                                <img src="../img/Biometric_Icon.png" alt="Biometric Icon" className="w-4 h-4" />
                                <p>Use Biometric Login</p>
                            </div>
                        </div>
                    </Card>
                </div>
            </div>
        </div>
    );
}

export default EmployeeLogin;
