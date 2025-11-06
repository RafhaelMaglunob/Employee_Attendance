import { useState, useMemo, useEffect } from 'react';
import { Clock, Calendar, Users, Download, Search, CheckCircle, XCircle, TrendingUp } from 'lucide-react';

function Auditing() {
    const [data, setData] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedDate, setSelectedDate] = useState('');
    const [searchQuery, setSearchQuery] = useState('');
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 10;

    useEffect(() => {
        fetchAttendance();
    }, [selectedDate]);

    const fetchAttendance = async () => {
        setLoading(true);
        try {
            const url = selectedDate 
                ? `http://192.168.1.9:3001/api/fingerprint/attendance/${selectedDate}`
                : 'http://192.168.1.9:3001/api/fingerprint/attendance';
            
            const response = await fetch(url);
            const result = await response.json();
            
            if (result.success) {
                setData(result.data);
            }
        } catch (error) {
            console.error('Error fetching attendance:', error);
        } finally {
            setLoading(false);
        }
    };

    const filteredData = useMemo(() => {
        return data.filter(item => 
            item.employee_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            item.employee_id.toLowerCase().includes(searchQuery.toLowerCase())
        );
    }, [data, searchQuery]);

    const paginatedData = useMemo(() => {
        const startIndex = (currentPage - 1) * itemsPerPage;
        return filteredData.slice(startIndex, startIndex + itemsPerPage);
    }, [filteredData, currentPage]);

    const totalPages = Math.ceil(filteredData.length / itemsPerPage);

    const stats = useMemo(() => {
        const total = filteredData.length;
        const present = filteredData.filter(d => d.clock_in).length;
        const complete = filteredData.filter(d => d.clock_in && d.clock_out).length;
        const avgHours = filteredData
            .filter(d => d.hours_worked)
            .reduce((sum, d) => sum + parseFloat(d.hours_worked), 0) / (complete || 1);

        return { total, present, complete, avgHours: avgHours.toFixed(1) };
    }, [filteredData]);

    const exportToCSV = () => {
        const headers = ['Employee ID', 'Employee Name', 'Date', 'Clock In', 'Clock Out', 'Hours Worked'];
        const csvData = filteredData.map(row => [
            row.employee_id,
            row.employee_name,
            row.date,
            row.clock_in || 'N/A',
            row.clock_out || 'N/A',
            row.hours_worked ? row.hours_worked.toFixed(2) : 'N/A'
        ]);

        const csv = [
            headers.join(','),
            ...csvData.map(row => row.join(','))
        ].join('\n');

        const blob = new Blob([csv], { type: 'text/csv' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `attendance_${selectedDate || 'all'}_${new Date().toISOString().split('T')[0]}.csv`;
        a.click();
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-screen bg-gradient-to-br from-blue-50 to-indigo-50">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-indigo-600 mx-auto mb-4"></div>
                    <p className="text-gray-600 text-lg">Loading attendance data...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 p-6">
            {/* Header */}
            <div className="mb-8">
                <h1 className="text-4xl font-bold text-gray-800 mb-2 flex items-center gap-3">
                    <div className="bg-indigo-600 p-3 rounded-xl">
                        <Clock className="text-white" size={32} />
                    </div>
                    Fingerprint Attendance
                </h1>
                <p className="text-gray-600 ml-14">Real-time biometric attendance tracking system</p>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
                <div className="bg-white rounded-2xl shadow-lg p-6 border-l-4 border-blue-500 transform transition hover:scale-105">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-gray-500 text-sm font-medium mb-1">Total Employees</p>
                            <p className="text-3xl font-bold text-gray-800">{stats.total}</p>
                        </div>
                        <div className="bg-blue-100 p-4 rounded-xl">
                            <Users className="text-blue-600" size={28} />
                        </div>
                    </div>
                </div>

                <div className="bg-white rounded-2xl shadow-lg p-6 border-l-4 border-green-500 transform transition hover:scale-105">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-gray-500 text-sm font-medium mb-1">Clocked In</p>
                            <p className="text-3xl font-bold text-gray-800">{stats.present}</p>
                        </div>
                        <div className="bg-green-100 p-4 rounded-xl">
                            <CheckCircle className="text-green-600" size={28} />
                        </div>
                    </div>
                </div>

                <div className="bg-white rounded-2xl shadow-lg p-6 border-l-4 border-purple-500 transform transition hover:scale-105">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-gray-500 text-sm font-medium mb-1">Completed</p>
                            <p className="text-3xl font-bold text-gray-800">{stats.complete}</p>
                        </div>
                        <div className="bg-purple-100 p-4 rounded-xl">
                            <XCircle className="text-purple-600" size={28} />
                        </div>
                    </div>
                </div>

                <div className="bg-white rounded-2xl shadow-lg p-6 border-l-4 border-orange-500 transform transition hover:scale-105">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-gray-500 text-sm font-medium mb-1">Avg Hours</p>
                            <p className="text-3xl font-bold text-gray-800">{stats.avgHours}</p>
                        </div>
                        <div className="bg-orange-100 p-4 rounded-xl">
                            <TrendingUp className="text-orange-600" size={28} />
                        </div>
                    </div>
                </div>
            </div>

            {/* Filters and Search */}
            <div className="bg-white rounded-2xl shadow-lg p-6 mb-8">
                <div className="flex flex-col md:flex-row gap-4">
                    <div className="flex-1 relative">
                        <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
                        <input
                            type="text"
                            placeholder="Search by name or ID..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full pl-12 pr-4 py-3 border-2 border-gray-200 rounded-xl focus:border-indigo-500 focus:outline-none transition"
                        />
                    </div>

                    <div className="flex-1 relative">
                        <Calendar className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
                        <input
                            type="date"
                            value={selectedDate}
                            onChange={(e) => setSelectedDate(e.target.value)}
                            className="w-full pl-12 pr-4 py-3 border-2 border-gray-200 rounded-xl focus:border-indigo-500 focus:outline-none transition"
                        />
                    </div>

                    <button
                        onClick={exportToCSV}
                        className="flex items-center gap-2 px-6 py-3 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition font-medium shadow-lg hover:shadow-xl"
                    >
                        <Download size={20} />
                        Export CSV
                    </button>
                </div>
            </div>

            {/* Table */}
            <div className="bg-white rounded-2xl shadow-lg overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead className="bg-gradient-to-r from-indigo-600 to-purple-600 text-white">
                            <tr>
                                <th className="px-6 py-4 text-left text-sm font-semibold">Employee ID</th>
                                <th className="px-6 py-4 text-left text-sm font-semibold">Employee Name</th>
                                <th className="px-6 py-4 text-left text-sm font-semibold">Date</th>
                                <th className="px-6 py-4 text-left text-sm font-semibold">Clock In</th>
                                <th className="px-6 py-4 text-left text-sm font-semibold">Clock Out</th>
                                <th className="px-6 py-4 text-left text-sm font-semibold">Hours</th>
                                <th className="px-6 py-4 text-left text-sm font-semibold">Status</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {paginatedData.length === 0 ? (
                                <tr>
                                    <td colSpan="7" className="px-6 py-12 text-center text-gray-500">
                                        No attendance records found
                                    </td>
                                </tr>
                            ) : (
                                paginatedData.map((record, index) => (
                                    <tr key={index} className="hover:bg-indigo-50 transition">
                                        <td className="px-6 py-4 text-sm font-medium text-gray-800">
                                            {record.employee_id}
                                        </td>
                                        <td className="px-6 py-4 text-sm text-gray-800 font-medium">
                                            {record.employee_name}
                                        </td>
                                        <td className="px-6 py-4 text-sm text-gray-600">
                                            {new Date(record.date).toLocaleDateString('en-US', { 
                                                month: 'short', 
                                                day: 'numeric', 
                                                year: 'numeric' 
                                            })}
                                        </td>
                                        <td className="px-6 py-4 text-sm">
                                            <span className="px-3 py-1 bg-green-100 text-green-700 rounded-lg font-medium">
                                                {record.clock_in || 'N/A'}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-sm">
                                            {record.clock_out ? (
                                                <span className="px-3 py-1 bg-red-100 text-red-700 rounded-lg font-medium">
                                                    {record.clock_out}
                                                </span>
                                            ) : (
                                                <span className="px-3 py-1 bg-gray-100 text-gray-500 rounded-lg font-medium">
                                                    Pending
                                                </span>
                                            )}
                                        </td>
                                        <td className="px-6 py-4 text-sm">
                                            {record.hours_worked ? (
                                                <span className="px-3 py-1 bg-blue-100 text-blue-700 rounded-lg font-medium">
                                                    {parseFloat(record.hours_worked).toFixed(2)}h
                                                </span>
                                            ) : (
                                                <span className="text-gray-400">-</span>
                                            )}
                                        </td>
                                        <td className="px-6 py-4 text-sm">
                                            {record.clock_in && record.clock_out ? (
                                                <span className="px-3 py-1 bg-green-100 text-green-700 rounded-full font-medium text-xs">
                                                    Complete
                                                </span>
                                            ) : record.clock_in ? (
                                                <span className="px-3 py-1 bg-yellow-100 text-yellow-700 rounded-full font-medium text-xs">
                                                    In Progress
                                                </span>
                                            ) : (
                                                <span className="px-3 py-1 bg-gray-100 text-gray-500 rounded-full font-medium text-xs">
                                                    No Record
                                                </span>
                                            )}
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Pagination */}
                {totalPages > 1 && (
                    <div className="px-6 py-4 bg-gray-50 border-t border-gray-200 flex items-center justify-between">
                        <div className="text-sm text-gray-600">
                            Showing {((currentPage - 1) * itemsPerPage) + 1} to {Math.min(currentPage * itemsPerPage, filteredData.length)} of {filteredData.length} entries
                        </div>
                        <div className="flex gap-2">
                            <button
                                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                                disabled={currentPage === 1}
                                className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed transition"
                            >
                                Previous
                            </button>
                            {[...Array(totalPages)].map((_, i) => (
                                <button
                                    key={i}
                                    onClick={() => setCurrentPage(i + 1)}
                                    className={`px-4 py-2 rounded-lg transition ${
                                        currentPage === i + 1
                                            ? 'bg-indigo-600 text-white'
                                            : 'border border-gray-300 hover:bg-gray-100'
                                    }`}
                                >
                                    {i + 1}
                                </button>
                            ))}
                            <button
                                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                                disabled={currentPage === totalPages}
                                className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed transition"
                            >
                                Next
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

export default Auditing;