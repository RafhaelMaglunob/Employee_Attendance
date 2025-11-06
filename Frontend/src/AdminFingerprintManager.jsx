import React, { useState, useEffect } from 'react';
import { Fingerprint, Trash2, RefreshCw, AlertCircle, CheckCircle, X, Search } from 'lucide-react';

const AdminFingerprintManager = () => {
  const [employees, setEmployees] = useState([]);
  const [filteredEmployees, setFilteredEmployees] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [selectedEmployee, setSelectedEmployee] = useState(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [actionStatus, setActionStatus] = useState({ type: '', message: '' });

  useEffect(() => {
    fetchEmployeesWithFingerprints();
  }, []);

  useEffect(() => {
    const filtered = employees.filter(emp =>
      emp.fullname.toLowerCase().includes(searchQuery.toLowerCase()) ||
      emp.position.toLowerCase().includes(searchQuery.toLowerCase())
    );
    setFilteredEmployees(filtered);
  }, [searchQuery, employees]);

  const fetchEmployeesWithFingerprints = async () => {
    try {
      const token = document.cookie
        .split('; ')
        .find(row => row.startsWith('employee_token=') || row.startsWith('admin_token='))
        ?.split('=')[1];

      const response = await fetch('http://192.168.1.9:3001/api/fingerprint/admin/employees', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      const data = await response.json();
      
      if (data.success) {
        setEmployees(data.employees);
        setFilteredEmployees(data.employees);
      }
    } catch (error) {
      console.error('Error fetching data:', error);
      setActionStatus({ type: 'error', message: 'Failed to load employees' });
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteFingerprint = async () => {
    try {
      setActionStatus({ type: 'processing', message: 'Deleting fingerprint...' });

      const token = document.cookie
        .split('; ')
        .find(row => row.startsWith('employee_token=') || row.startsWith('admin_token='))
        ?.split('=')[1];

      const response = await fetch(`http://192.168.1.9:3001/api/fingerprint/${selectedEmployee.fingerprint_slot}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      const data = await response.json();

      if (data.success) {
        setActionStatus({ type: 'success', message: 'Fingerprint deleted successfully!' });
        await fetchEmployeesWithFingerprints();
        
        setTimeout(() => {
          setShowDeleteModal(false);
          setSelectedEmployee(null);
          setActionStatus({ type: '', message: '' });
        }, 2000);
      } else {
        throw new Error(data.error || 'Failed to delete fingerprint');
      }
    } catch (error) {
      setActionStatus({ type: 'error', message: error.message });
    }
  };

  const openDeleteModal = (employee) => {
    setSelectedEmployee(employee);
    setShowDeleteModal(true);
    setActionStatus({ type: '', message: '' });
  };

  const closeModal = () => {
    setShowDeleteModal(false);
    setSelectedEmployee(null);
    setActionStatus({ type: '', message: '' });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <RefreshCw className="w-8 h-8 animate-spin text-indigo-600" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Fingerprint Management</h1>
          <p className="text-gray-600">View and manage employee fingerprint registrations</p>
        </div>

        {/* Search Bar */}
        <div className="mb-6">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input
              type="text"
              placeholder="Search by name, or position..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-12 pr-4 py-3 rounded-xl border border-gray-300 focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            />
          </div>
        </div>

        {/* Statistics */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-indigo-100 rounded-lg flex items-center justify-center">
                <Fingerprint className="w-6 h-6 text-indigo-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900">
                  {employees.filter(e => e.fingerprint_registered).length}
                </p>
                <p className="text-sm text-gray-600">Registered</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-yellow-100 rounded-lg flex items-center justify-center">
                <AlertCircle className="w-6 h-6 text-yellow-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900">
                  {employees.filter(e => !e.fingerprint_registered).length}
                </p>
                <p className="text-sm text-gray-600">Not Registered</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
                <CheckCircle className="w-6 h-6 text-green-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900">{employees.length}</p>
                <p className="text-sm text-gray-600">Total Employees</p>
              </div>
            </div>
          </div>
        </div>

        {/* Employee Table */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                    Employee
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                    Position
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                    Type
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                    Fingerprint Status
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                    Slot
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                    Registered At
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                    Last Used
                  </th>
                  <th className="px-6 py-4 text-right text-xs font-semibold text-gray-700 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {filteredEmployees.map((employee) => (
                  <tr key={employee.employee_id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4">
                      <div>
                        <p className="font-medium text-gray-900">{employee.fullname}</p>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-700">
                      {employee.position}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-700">
                      {employee.employment_type}
                    </td>
                    <td className="px-6 py-4">
                      {employee.fingerprint_registered ? (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-green-100 text-green-700 border border-green-200">
                          <CheckCircle className="w-3.5 h-3.5" />
                          Registered
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-700 border border-yellow-200">
                          <AlertCircle className="w-3.5 h-3.5" />
                          Not Registered
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-700">
                      {employee.fingerprint_slot || '-'}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-700">
                      {employee.registered_at || '-'}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-700">
                      {employee.last_used || '-'}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex justify-end gap-2">
                        {employee.fingerprint_registered ? (
                          <button
                            onClick={() => openDeleteModal(employee)}
                            className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                            title="Delete Fingerprint"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        ) : (
                          <span className="text-sm text-gray-400 italic">
                            Employee must enroll via their dashboard
                          </span>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {filteredEmployees.length === 0 && (
            <div className="py-12 text-center">
              <Fingerprint className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500">No employees found</p>
            </div>
          )}
        </div>
      </div>

      {/* Delete Modal */}
      {showDeleteModal && selectedEmployee && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
            <div className="bg-gradient-to-r from-red-600 to-pink-600 p-6 text-white rounded-t-2xl">
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="text-xl font-bold mb-1">Delete Fingerprint</h3>
                  <p className="text-red-100 text-sm">{selectedEmployee.fullname}</p>
                </div>
                <button onClick={closeModal} className="text-white/80 hover:text-white">
                  <X className="w-6 h-6" />
                </button>
              </div>
            </div>

            <div className="p-6 space-y-6">
              {actionStatus.type === '' && (
                <>
                  <div className="bg-red-50 p-4 rounded-xl border border-red-200">
                    <p className="text-sm text-red-900 mb-3">
                      Are you sure you want to delete the fingerprint for this employee?
                    </p>
                    <div className="space-y-1 text-sm text-red-700">
                      <p><strong>Employee:</strong> {selectedEmployee.fullname}</p>
                      <p><strong>Slot:</strong> {selectedEmployee.fingerprint_slot}</p>
                      <p><strong>Registered:</strong> {selectedEmployee.registered_at}</p>
                    </div>
                  </div>

                  <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4">
                    <p className="text-sm text-yellow-800">
                      ⚠️ The employee will need to re-enroll their fingerprint through their dashboard.
                    </p>
                  </div>

                  <div className="flex gap-3">
                    <button
                      onClick={closeModal}
                      className="flex-1 px-4 py-3 bg-gray-200 text-gray-700 rounded-xl font-semibold hover:bg-gray-300 transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleDeleteFingerprint}
                      className="flex-1 px-4 py-3 bg-gradient-to-r from-red-600 to-pink-600 text-white rounded-xl font-semibold hover:from-red-700 hover:to-pink-700 transition-all"
                    >
                      Delete
                    </button>
                  </div>
                </>
              )}

              {actionStatus.type === 'processing' && (
                <div className="text-center py-8">
                  <RefreshCw className="w-16 h-16 text-red-600 mx-auto mb-4 animate-spin" />
                  <p className="text-gray-700 font-medium">{actionStatus.message}</p>
                </div>
              )}

              {actionStatus.type === 'success' && (
                <div className="text-center py-8">
                  <CheckCircle className="w-16 h-16 text-green-600 mx-auto mb-4" />
                  <p className="text-green-600 font-medium text-lg">{actionStatus.message}</p>
                </div>
              )}

              {actionStatus.type === 'error' && (
                <div className="text-center py-8">
                  <AlertCircle className="w-16 h-16 text-red-600 mx-auto mb-4" />
                  <p className="text-red-600 font-medium">{actionStatus.message}</p>
                  <button
                    onClick={closeModal}
                    className="mt-4 px-6 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
                  >
                    Close
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminFingerprintManager;