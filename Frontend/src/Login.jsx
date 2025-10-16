import React, { useState } from 'react'
import { Card } from './component/ui/card'
import Background from './component/ui/Background'
import { Button } from './component/ui/button'
import { useNavigate } from 'react-router-dom';
import Cookies from "js-cookie";

function Login() {
    const navigate = useNavigate();
    const [showLogin, setShowLogin] = useState(false)
    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [error, setError] = useState('')

    const headerContent = (
        <div className="flex flex-rows justify-between w-full">
            <h1 className="text-xl font-bold font-inter">Employee Management System</h1>
            <Button onClick={() => setShowLogin(false)} className="flex md:hidden">
                X
            </Button>
        </div>
    )

    const handleLogin = async () => {
        const res = await fetch("http://localhost:3001/api/admin/login", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email, password }),
        });

        const data = await res.json();

        if (!res.ok) {
            setError(data.error || "Login failed");
        } else {
            Cookies.set("auth_token", data.token, { expires: 1 });
            localStorage.setItem("userRole", data.data.role);
            navigate("/dashboard", { replace: true }); 
        }
    };



    return (
        <div className="w-full h-screen flex flex-col">
            <Background className="fixed inset-0 -z-10 pointer-events-none" />
            
            {/* Sticky Top Bar */}
            <div className="w-full h-15 bg-[#FFC629] sticky top-0 z-40 flex justify-end border-b-8 border-b-[#5E451D]">
                <div className="md:hidden flex items-center justify-center px-4">
                    {!showLogin && (
                        <Button
                            onClick={() => setShowLogin(true)}
                            className="rounded-[50px]"
                        >
                            <p className="rounded-lg px-4 py-1 bg-green-400 text-white">Login</p>
                        </Button>
                    )}
                </div>
            </div>
            
            {/* Main Content */}
            <div className="flex flex-1 flex-col md:flex-row items-center justify-center px-4 md:px-15 space-y-6 md:space-y-0 md:space-x-15">
                {/* Logo */}
                <div className="sm:relative -z-5 absolute flex md:static">
                    <img 
                        src="../img/TheCrunchLogoChicken 1.png" 
                        alt="The Crunch Logo" 
                        className="w-150 h-150"
                    />
                </div>

                {/* Login Card */}
                <div
                    className={`w-full sm:w-[470px] transition-all duration-500 ${
                        showLogin ? 'opacity-100 scale-100' : 'opacity-0 scale-90 md:opacity-100 md:scale-100'
                    } ${!showLogin && 'hidden md:block'}`}
                >
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
                            <input
                                type="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                className="bg-white px-4 py-2 w-full rounded-sm border-2 focus:outline-blue-400"
                            />
                            
                            <button
                                onClick={handleLogin}
                                className="bg-black text-white w-full py-4 text-xl font-bold rounded-md mt-3"
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
                                <a className="cursor-pointer border-b border-transparent hover:border-current">Forgot Password</a>
                            </div>
                        </div>
                    </Card>
                </div>
            </div>
        </div>
    )
}

export default Login
