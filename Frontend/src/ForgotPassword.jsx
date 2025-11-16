// components/ForgotPassword.jsx
import React, { useState } from 'react'
import { Card } from './component/ui/card'
import Background from './component/ui/Background'
import { useNavigate } from 'react-router-dom'

function ForgotPassword() {
    const navigate = useNavigate()
    const [email, setEmail] = useState('')
    const [message, setMessage] = useState('')
    const [error, setError] = useState('')
    const [isLoading, setIsLoading] = useState(false)

    // Vite uses import.meta.env instead of process.env
    const API_URL = import.meta.env.VITE_API_URL || 'http://192.168.1.9:3001'

    const headerContent = (
        <div className="flex flex-rows justify-between w-full">
            <h1 className="text-md sm:text-xl font-bold font-inter">Reset Your Password</h1>
        </div>
    )

    const handleSubmit = async () => {
        if (!email) {
            setError('Please enter your email address')
            return
        }

        // Email validation
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
        if (!emailRegex.test(email)) {
            setError('Please enter a valid email address')
            return
        }

        setIsLoading(true)
        setError('')
        setMessage('')

        try {
            console.log('Sending request to:', `${API_URL}/api/admin/forgot-password`)
            const res = await fetch(`${API_URL}/api/admin/forgot-password`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email }),
            })

            console.log('Response status:', res.status)
            const data = await res.json()
            console.log('Response data:', data)

            if (!res.ok) {
                setError(data.error || "Failed to send reset email")
            } else {
                setMessage("If an account exists with this email, a password reset link has been sent. Please check your inbox.")
                setEmail('')
            }
        } catch (err) {
            console.error('Forgot password error:', err)
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

    return (
        <div className="w-full h-screen flex flex-col">
            <Background className="fixed inset-0 -z-10 pointer-events-none" />
            
            {/* Sticky Top Bar */}
            <div className="w-full h-15 bg-[#FFC629] sticky top-0 z-40 flex justify-end border-b-8 border-b-[#5E451D]">
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

                {/* Forgot Password Card */}
                <div className="w-full sm:w-[470px]">
                    <Card header={headerContent} className="[&_*]:text-xl" radius="none" width="full">
                        <div className="flex flex-col space-y-3 px-2 py-4">
                            <p className="text-sm text-gray-600 mb-2">
                                Enter your email address and we'll send you a link to reset your password.
                            </p>

                            <label>Email Address</label>
                            <input 
                                type="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                onKeyPress={handleKeyPress}
                                className="bg-white px-4 py-2 w-full rounded-sm border-2 focus:outline-blue-400"
                                placeholder="your@email.com"
                                disabled={isLoading}
                            />
                            
                            <button
                                onClick={handleSubmit}
                                disabled={isLoading}
                                className="bg-black text-white w-full py-4 text-xl font-bold rounded-md mt-3 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-800 transition-colors"
                            >
                                {isLoading ? 'Sending...' : 'Send Reset Link'}
                            </button>

                            {message && (
                                <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded text-sm">
                                    {message}
                                </div>
                            )}

                            {error && (
                                <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded text-sm">
                                    {error}
                                </div>
                            )}

                            <div className="flex items-center my-4">
                                <div className="border-t border-gray-700 flex-1"></div>
                                <span className="px-3 text-gray-600 text-sm font-medium">or</span>
                                <div className="border-t border-gray-700 flex-1"></div>
                            </div>

                            <div className="text-blue-600 flex items-center text-center justify-center mt-3">
                                <a 
                                    onClick={() => navigate('/')}
                                    className="cursor-pointer border-b border-transparent hover:border-current text-base"
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

export default ForgotPassword   