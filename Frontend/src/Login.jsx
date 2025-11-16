import React, { useState, useEffect } from 'react'
import { Card } from './component/ui/card'
import Background from './component/ui/Background'
import { Button } from './component/ui/button'
import { useNavigate } from 'react-router-dom';
import Cookies from "js-cookie"


function Login() {
    const navigate = useNavigate();
    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [error, setError] = useState('')
    const [showPassword, setShowPassword] = useState('password');

    const API_URL = import.meta.env.VITE_API_URL || 'http://192.168.1.9:3001'

    const headerContent = (
        <div className="flex flex-rows justify-between w-full">
            <h1 className="text-md sm:text-xl font-bold font-inter">Employee Management System</h1>
        </div>
    )
    
    useEffect(() => {
        const token = localStorage.getItem("admin_token");
        if (token) {
            navigate("/employees", { replace: true });
        }
    }, [navigate]);

    const handleLogin = async () => {
        console.log('🔵 Attempting login to:', `${API_URL}/api/admin/login`);
        console.log('🔵 Email:', email);
        
        try {
            const res = await fetch(`${API_URL}/api/admin/login`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email, password }),
            });

            console.log('🔵 Response status:', res.status);
            console.log('🔵 Response ok:', res.ok);

            const data = await res.json();
            console.log('🔵 Response data:', data);

            if (!res.ok) {
                setError(data.error || "Login failed");
            } else {
                localStorage.setItem("admin_token", data.token);
                localStorage.setItem("userRole", data.data.role);
                localStorage.setItem("userEmail", data.data.email);
                localStorage.setItem("userFullname", data.data.fullname);

                Cookies.set("admin_token", data.token, { expires: 1, sameSite: "Strict" });

                console.log('✅ Login successful, navigating to dashboard');
                navigate("/dashboard", { replace: true });
            }
        } catch (error) {
            console.error('🔴 Fetch error:', error);
            setError('Network error: ' + error.message);
        }
    };

    const handleForgotPassword = () => {
        navigate('/forgot-password');
    };

    return (
        <div className="w-full h-screen flex flex-col">
            <Background className="fixed inset-0 -z-10 pointer-events-none" />
            
            <div className="w-full h-15 bg-[#FFC629] sticky top-0 z-40 flex justify-end border-b-8 border-b-[#5E451D]">
            </div>
            
            <div className="flex flex-1 flex-col md:flex-row items-center justify-center px-4 md:px-15 space-y-6 md:space-y-0 md:space-x-15">
                <div className="sm:relative -z-5 absolute flex md:static">
                    <img 
                        src="../img/TheCrunchLogoChicken 1.png" 
                        alt="The Crunch Logo" 
                        className="w-150 h-150"
                    />
                </div>

                <div className={`w-full sm:w-[470px] transition-all duration-500`}>
                    <Card header={headerContent} className="[&_*]:text-xl" radius="none" width="full">
                        <div className="flex flex-col space-y-3 px-2 py-4 relative">
                            <label>Username</label>
                            <input 
                                type="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                className="bg-white px-4 py-2 w-full rounded-sm border-2 focus:outline-blue-400"
                            />

                            <label>Password</label>
                            <div className="relative">
                            <input
                                type={showPassword ? "text" : "password"}
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                onKeyPress={(e) => e.key === 'Enter' && handleLogin()}
                                className="bg-white px-4 py-2 w-full rounded-sm border-2 focus:outline-blue-400 pr-10"
                            />

                            <button
                                type="button"
                                onClick={() => setShowPassword(!showPassword)}
                                className="absolute right-2 top-1/2 -translate-y-1/2 text-sm text-gray-600 hover:text-black"
                            >
                                {showPassword ? "Hide" : "Show"}
                            </button>
                            </div>

                            
                            <button
                                onClick={handleLogin}
                                className="bg-black text-white w-full py-4 text-xl font-bold rounded-md mt-3 hover:bg-gray-800 transition-colors"
                            >
                                Login
                            </button>

                            {error && <p className="text-red-500 text-center mt-2">{error}</p>}

                            <div className="flex items-center my-4">
                                <div className="border-t border-gray-700 flex-1"></div>
                                <span className="px-3 text-gray-600 text-sm font-medium">or</span>
                                <div className="border-t border-gray-700 flex-1"></div>
                            </div>

                            <div className="text-red-600 flex items-center text-center justify-center mt-3">
                                <a 
                                    onClick={handleForgotPassword}
                                    className="cursor-pointer border-b border-transparent hover:border-current text-base"
                                >
                                    Forgot Password
                                </a>
                            </div>
                        </div>
                    </Card>
                </div>
            </div>
        </div>
    )
}

export default Login