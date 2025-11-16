// components/EmployeeResetPassword.jsx
import React, { useState, useEffect } from 'react'
import { Card } from './component/ui/card'
import Background from './component/ui/Background'
import { useNavigate, useParams } from 'react-router-dom'
import { Eye, EyeOff } from 'lucide-react'

function EmployeeResetPassword() {
    const navigate = useNavigate()
    const { token } = useParams()
    const [password, setPassword] = useState('')
    const [confirmPassword, setConfirmPassword] = useState('')
    const [message, setMessage] = useState('')
    const [error, setError] = useState('')
    const [isLoading, setIsLoading] = useState(false)
    const [isValidToken, setIsValidToken] = useState(false)
    const [isVerifying, setIsVerifying] = useState(true)
    const [showPassword, setShowPassword] = useState(false)
    const [showConfirmPassword, setShowConfirmPassword] = useState(false)

    // Vite uses import.meta.env instead of process.env
    const API_URL = import.meta.env.VITE_API_URL || 'http://192.168.1.9:3001'

    const headerContent = (
        <div className="flex flex-row justify-between w-full">
            <h1 className="text-base sm:text-xl font-bold font-inter">Create New Password</h1>
        </div>
    )

    useEffect(() => {
        // Verify token on component mount
        const verifyToken = async () => {
            try {
                const res = await fetch(`${API_URL}/api/employee/verify-reset-token/${token}`)
                const data = await res.json()
                
                if (res.ok) {
                    setIsValidToken(true)
                } else {
                    setError('Invalid or expired reset link')
                }
            } catch (err) {
                console.error('Token verification error:', err)
                setError('Failed to verify reset link')
            } finally {
                setIsVerifying(false)
            }
        }

        if (token) {
            verifyToken()
        } else {
            setError('No reset token provided')
            setIsVerifying(false)
        }
    }, [token, API_URL])

    const handleSubmit = async () => {
        setError('')
        setMessage('')

        // Validation
        if (!password || !confirmPassword) {
            setError('Please fill in all fields')
            return
        }

        if (password.length < 6) {
            setError('Password must be at least 6 characters long')
            return
        }

        if (password !== confirmPassword) {
            setError('Passwords do not match')
            return
        }

        setIsLoading(true)

        try {
            const res = await fetch(`${API_URL}/api/employee/reset-password`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ token, newPassword: password }),
            })

            const data = await res.json()

            if (!res.ok) {
                setError(data.error || "Failed to reset password")
            } else {
                setMessage("Password successfully reset! Redirecting to login...")
                setTimeout(() => {
                    navigate('/employee-login')
                }, 2000)
            }
        } catch (err) {
            console.error('Reset password error:', err)
            setError("Network error. Please try again.")
        } finally {
            setIsLoading(false)
        }
    }

    const handleKeyPress = (e) => {
        if (e.key === 'Enter' && !isLoading) {
            handleSubmit()
        }
    }

    if (isVerifying) {
        return (
            <div className="w-full min-h-screen flex flex-col overflow-x-hidden">
                <Background className="fixed inset-0 -z-10 pointer-events-none" />
                <div className="w-full h-15 bg-[#FFC629] sticky top-0 z-40 flex justify-end border-b-8 border-b-[#5E451D]"></div>
                <div className="flex flex-1 items-center justify-center p-4">
                    <p className="text-lg sm:text-xl text-center">Verifying reset link...</p>
                </div>
            </div>
        )
    }

    if (!isValidToken) {
        return (
            <div className="w-full min-h-screen flex flex-col overflow-x-hidden">
                <Background className="fixed inset-0 -z-10 pointer-events-none" />
                <div className="w-full h-15 bg-[#FFC629] sticky top-0 z-40 flex justify-end border-b-8 border-b-[#5E451D]"></div>
                <div className="flex flex-1 items-center justify-center p-4">
                    <Card className="w-full max-w-md">
                        <div className="text-center py-6 sm:py-8 px-4">
                            <h2 className="text-xl sm:text-2xl font-bold text-red-600 mb-4">Invalid Reset Link</h2>
                            <p className="text-sm sm:text-base text-gray-600 mb-6">{error}</p>
                            <button
                                onClick={() => navigate('/employee/forgot-password')}
                                className="bg-black text-white px-6 py-3 rounded-md font-bold hover:bg-gray-800 transition-colors w-full sm:w-auto"
                            >
                                Request New Link
                            </button>
                        </div>
                    </Card>
                </div>
            </div>
        )
    }

    return (
        <div className="w-full min-h-screen flex flex-col overflow-x-hidden">
            <Background className="fixed inset-0 -z-10 pointer-events-none" />
            
            {/* Sticky Top Bar */}
            <div className="w-full h-15 bg-[#FFC629] sticky top-0 z-40 flex justify-end border-b-8 border-b-[#5E451D]">
            </div>
            
            {/* Main Content */}
            <div className="flex flex-1 flex-col lg:flex-row items-center justify-center px-4 py-8 lg:py-0 gap-6 lg:gap-12">
                {/* Logo */}
                <div className="flex-shrink-0 w-full max-w-[300px] lg:max-w-none lg:w-auto flex justify-center">
                    <img 
                        src="../img/TheCrunchLogoChicken 1.png" 
                        alt="The Crunch Logo" 
                        className="w-full max-w-[250px] lg:max-w-[350px] h-auto object-contain"
                    />
                </div>

                {/* Reset Password Card */}
                <div className="w-full max-w-[470px]">
                    <Card header={headerContent} className="[&_*]:text-base sm:[&_*]:text-xl" radius="none" width="full">
                        <div className="flex flex-col space-y-3 px-4 sm:px-6 py-4">
                            <p className="text-xs sm:text-sm text-gray-600 mb-2">
                                Enter your new password below.
                            </p>

                            {/* New Password Field */}
                            <label className="text-sm sm:text-base font-medium">New Password</label>
                            <div className="relative">
                                <input 
                                    type={showPassword ? "text" : "password"}
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    onKeyPress={handleKeyPress}
                                    className="bg-white px-4 py-2 w-full rounded-sm border-2 focus:outline-blue-400 pr-12 text-sm sm:text-base"
                                    placeholder="Enter new password"
                                    disabled={isLoading}
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700 focus:outline-none"
                                    disabled={isLoading}
                                >
                                    {showPassword ? (
                                        <EyeOff className="w-5 h-5" />
                                    ) : (
                                        <Eye className="w-5 h-5" />
                                    )}
                                </button>
                            </div>

                            {/* Confirm Password Field */}
                            <label className="text-sm sm:text-base font-medium">Confirm Password</label>
                            <div className="relative">
                                <input 
                                    type={showConfirmPassword ? "text" : "password"}
                                    value={confirmPassword}
                                    onChange={(e) => setConfirmPassword(e.target.value)}
                                    onKeyPress={handleKeyPress}
                                    className="bg-white px-4 py-2 w-full rounded-sm border-2 focus:outline-blue-400 pr-12 text-sm sm:text-base"
                                    placeholder="Confirm new password"
                                    disabled={isLoading}
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700 focus:outline-none"
                                    disabled={isLoading}
                                >
                                    {showConfirmPassword ? (
                                        <EyeOff className="w-5 h-5" />
                                    ) : (
                                        <Eye className="w-5 h-5" />
                                    )}
                                </button>
                            </div>
                            
                            <button
                                onClick={handleSubmit}
                                disabled={isLoading}
                                className="bg-black text-white w-full py-3 sm:py-4 text-base sm:text-xl font-bold rounded-md mt-3 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-800 transition-colors"
                            >
                                {isLoading ? 'Resetting...' : 'Reset Password'}
                            </button>

                            {message && (
                                <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded text-xs sm:text-sm break-words">
                                    {message}
                                </div>
                            )}

                            {error && (
                                <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded text-xs sm:text-sm break-words">
                                    {error}
                                </div>
                            )}

                            <div className="flex items-center my-4">
                                <div className="border-t border-gray-700 flex-1"></div>
                                <span className="px-3 text-gray-600 text-xs sm:text-sm font-medium">or</span>
                                <div className="border-t border-gray-700 flex-1"></div>
                            </div>

                            <div className="text-blue-600 flex items-center text-center justify-center mt-3">
                                <a 
                                    onClick={() => navigate('/employee-login')}
                                    className="cursor-pointer border-b border-transparent hover:border-current text-sm sm:text-base"
                                >
                                    Back to Login
                                </a>
                            </div>
                        </div>
                    </Card>
                </div>
            </div>
        </div>
    )
}

export default EmployeeResetPassword