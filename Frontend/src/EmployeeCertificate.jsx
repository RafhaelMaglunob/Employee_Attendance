import React, { useState, useEffect } from 'react';
import Cookies from "js-cookie"

function EmployeeCertificate() {
    const [purpose, setPurpose] = useState('');
    const [requests, setRequests] = useState([]);
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState({ text: '', type: '' });
    
    const employeeId = localStorage.getItem('employeeId');

    useEffect(() => {
        fetchMyCertificates();
    }, []);

    const fetchMyCertificates = async () => {
        const token = Cookies.get("employee_token");
        
        try {
        const res = await fetch(`http://192.168.1.9:3001/api/employee/${employeeId}/certificates`, {
            headers: {
            'Authorization': `Bearer ${token}`
            }
        });
        const data = await res.json();
        if (data.success) {
            setRequests(data.data);
        }
        } catch (err) {
        console.error('Error fetching certificates:', err);
        }
    };

    const handleSubmit = async () => {
        if (!purpose.trim()) {
            setMessage({ text: 'Please enter a purpose', type: 'error' });
            return;
        }

        setLoading(true);
        const token = Cookies.get("employee_token"); // ✅ use cookie here
        if (!token) {
            setMessage({ text: 'You are not logged in', type: 'error' });
            setLoading(false);
            return;
        }

        try {
            const res = await fetch(`http://192.168.1.9:3001/api/employee/${employeeId}/certificate`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}` // ✅ use cookie token
            },
            body: JSON.stringify({ purpose })
            });

            const data = await res.json();
            
            if (data.success) {
            setMessage({ text: '✅ Certificate request submitted!', type: 'success' });
            setPurpose('');
            fetchMyCertificates();
            } else {
            setMessage({ text: data.message || 'Failed to submit request', type: 'error' });
            }
        } catch (err) {
            setMessage({ text: 'Server error. Please try again.', type: 'error' });
        } finally {
            setLoading(false);
        }
    };


    const downloadCertificate = async (certificateId) => {
        try {
            const res = await fetch(
                `http://192.168.1.9:3001/api/employee/certificate/${certificateId}/download`,
                {
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('employee_token')}`
                }
                }
            );
            
            if (res.ok) {
                const blob = await res.blob();
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `Certificate_${certificateId}.pdf`;
                document.body.appendChild(a);
                a.click();
                a.remove();
            }
        } catch (err) {
            console.error('Download error:', err);
        }
    };

    const getStatusColor = (status) => {
        switch (status) {
            case 'Approved': return 'text-green-600 bg-green-50';
            case 'Rejected': return 'text-red-600 bg-red-50';
            default: return 'text-yellow-600 bg-yellow-50';
        }
    };

    return (
        <div className="min-h-screen bg-gray-50 p-4">
            <div className="max-w-4xl mx-auto">
                {/* Header */}
                <div className="bg-white shadow-lg rounded-lg p-6 mb-6">
                    <h1 className="text-2xl font-bold text-gray-800 mb-2">
                        Certificate of Employment
                    </h1>
                    <p className="text-gray-600 text-sm">
                        Request a certificate for official purposes
                    </p>
                </div>

                {/* Request Section */}
                <div className="bg-white shadow-lg rounded-lg p-6 mb-6">
                    <h2 className="text-lg font-semibold mb-4">New Request</h2>
                    
                    <div className="space-y-4">
                        <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            Purpose of Certificate *
                        </label>
                        <select
                            value={purpose}
                            onChange={(e) => setPurpose(e.target.value)}
                            className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        >
                            <option value="">Select purpose...</option>
                            <option value="Bank Loan">Bank Loan</option>
                            <option value="Visa Application">Visa Application</option>
                            <option value="Government Transaction">Government Transaction</option>
                            <option value="Rental Application">Rental Application</option>
                            <option value="Personal Record">Personal Record</option>
                            <option value="Other">Other</option>
                        </select>
                        </div>

                        {message.text && (
                        <div className={`p-3 rounded-lg ${
                            message.type === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'
                        }`}>
                            {message.text}
                        </div>
                        )}

                        <button
                        onClick={handleSubmit}
                        disabled={loading}
                        className="w-full bg-blue-600 text-white py-3 rounded-lg font-semibold hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
                        >
                        {loading ? 'Submitting...' : 'Submit Request'}
                        </button>
                    </div>
                </div>

                {/* Previous Requests */}
                <div className="bg-white shadow-lg rounded-lg p-6">
                    <h2 className="text-lg font-semibold mb-4">My Requests</h2>
                    
                    {requests.length === 0 ? (
                        <p className="text-gray-500 text-center py-8">No requests yet</p>
                    ) : (
                        <div className="space-y-3">
                            {requests.map((req) => (
                                <div
                                key={req.certificate_id}
                                className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow"
                                >
                                <div className="flex justify-between items-start mb-2">
                                    <div>
                                    <p className="font-semibold text-gray-800">{req.purpose}</p>
                                    <p className="text-sm text-gray-500">
                                        Requested: {new Date(req.request_date).toLocaleDateString()}
                                    </p>
                                    </div>
                                    <span className={`px-3 py-1 rounded-full text-xs font-semibold ${getStatusColor(req.status)}`}>
                                    {req.status}
                                    </span>
                                </div>

                                {req.status === 'Approved' && (
                                    <div className="mt-3 flex items-center gap-3">
                                            <button
                                                onClick={() => downloadCertificate(req.certificate_id)}
                                                className="bg-green-600 text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-green-700 transition-colors"
                                            >
                                                📄 Download PDF
                                            </button>
                                            <p className="text-xs text-gray-500">
                                                Approved by {req.approved_by_name || 'HR'}
                                            </p>
                                            </div>
                                        )}

                                        {req.status === 'Rejected' && req.remarks && (
                                            <div className="mt-2 p-2 bg-red-50 rounded text-sm text-red-700">
                                            <strong>Reason:</strong> {req.remarks}
                                            </div>
                                        )}
                                    </div>
                                ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

export default EmployeeCertificate;