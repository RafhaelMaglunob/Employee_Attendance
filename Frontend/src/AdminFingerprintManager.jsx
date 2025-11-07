import React, { useState, useEffect } from 'react';
import { Fingerprint, Trash2, RefreshCw, AlertCircle, CheckCircle, X, Search, RotateCcw, Plus } from 'lucide-react';

const AdminFingerprintManager = () => {
  const [employees, setEmployees] = useState([]);
  const [filteredEmployees, setFilteredEmployees] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [selectedEmployee, setSelectedEmployee] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [modalMode, setModalMode] = useState('delete');
  const [actionStatus, setActionStatus] = useState({ type: '', message: '' });
  const [enrollSlot, setEnrollSlot] = useState('');
  const [isPolling, setIsPolling] = useState(false);
  const [autoSlot, setAutoSlot] = useState(false);

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

  const getToken = () => {
    const cookies = document.cookie.split('; ');
    
    // Try admin_token first
    const adminToken = cookies
      .find(row => row.startsWith('admin_token='))
      ?.split('=')[1];
    
    // Try employee_token if admin_token not found or is "undefined"
    const employeeToken = cookies
      .find(row => row.startsWith('employee_token='))
      ?.split('=')[1];
    
    // Return whichever is valid (not undefined string)
    const token = (adminToken && adminToken !== 'undefined') ? adminToken : employeeToken;
    
    // Filter out "undefined" string
    return (token && token !== 'undefined') ? token : null;
  };

  const fetchEmployeesWithFingerprints = async () => {
    try {
      const token = getToken();
      
      if (!token) {
        setActionStatus({ type: 'error', message: '❌ No authentication token found. Please log in again.' });
        setLoading(false);
        return;
      }

      const response = await fetch('http://192.168.1.9:3001/api/fingerprint/admin/employees', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(`${response.status}: ${data.error || 'Unknown error'}`);
      }
      
      if (data.success) {
        setEmployees(data.employees);
        setFilteredEmployees(data.employees);
        setActionStatus({ type: '', message: '' });
      } else {
        throw new Error(data.error || 'Failed to fetch employees');
      }
    } catch (error) {
      console.error('Error fetching data:', error);
      setActionStatus({ 
        type: 'error', 
        message: `Failed to load employees: ${error.message}` 
      });
    } finally {
      setLoading(false);
    }
  };

  const findFirstAvailableSlot = () => {
    const occupiedSlots = employees
      .filter(emp => emp.fingerprint_registered && emp.fingerprint_slot)
      .map(emp => parseInt(emp.fingerprint_slot));
    
    for (let slot = 1; slot <= 127; slot++) {
      if (!occupiedSlots.includes(slot)) {
        return slot;
      }
    }
    return null; // All slots occupied
  };

  const handleEnrollFingerprint = async () => {
    let slotToUse = enrollSlot;

    // If auto mode is enabled, find first available slot
    if (autoSlot) {
      const availableSlot = findFirstAvailableSlot();
      if (!availableSlot) {
        setActionStatus({ type: 'error', message: 'No available slots (1-127). All slots are occupied.' });
        return;
      }
      slotToUse = availableSlot;
      setEnrollSlot(availableSlot.toString()); // Update UI to show which slot was auto-selected
    } else if (!slotToUse || slotToUse < 1 || slotToUse > 127) {
      setActionStatus({ type: 'error', message: 'Please enter a valid slot number (1-127)' });
      return;
    }

    try {
      setActionStatus({ type: 'processing', message: `Starting enrollment in slot ${slotToUse}...` });
      const token = getToken();

      if (!token) {
        setActionStatus({ type: 'error', message: '❌ No authentication token found. Please log in again.' });
        return;
      }

      const response = await fetch('http://192.168.1.9:3001/api/fingerprint/enroll', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          employee_id: selectedEmployee.employee_id,
          slot: parseInt(slotToUse)
        })
      });

      const data = await response.json();

      if (response.ok && data.success) {
        setActionStatus({ type: 'processing', message: 'Enrollment started! Place finger on sensor...' });
        setIsPolling(true);
        pollEnrollmentStatus(slotToUse);
      } else {
        throw new Error(data.error || `Server returned ${response.status}: ${JSON.stringify(data)}`);
      }
    } catch (error) {
      console.error('❌ Enroll error:', error);
      setActionStatus({ type: 'error', message: error.message || 'Failed to start enrollment' });
    }
  };

  const pollEnrollmentStatus = async (slot) => {
    const maxAttempts = 60; // 60 seconds timeout
    let attempts = 0;

    const poll = setInterval(async () => {
      attempts++;
      
      if (attempts > maxAttempts) {
        clearInterval(poll);
        setIsPolling(false);
        setActionStatus({ type: 'error', message: 'Enrollment timeout. Please try again.' });
        return;
      }

      try {
        const response = await fetch(`http://192.168.1.9:3001/api/fingerprint/enroll-status?slot=${slot}`);
        const data = await response.json();

        if (data.status === 'complete') {
          clearInterval(poll);
          setIsPolling(false);
          setActionStatus({ 
            type: 'success', 
            message: 'Fingerprint enrolled successfully!' 
          });
          
          await fetchEmployeesWithFingerprints();
          
          setTimeout(() => {
            closeModal();
            setActionStatus({ type: '', message: '' });
          }, 2000);
        } else if (data.status === 'error') {
          clearInterval(poll);
          setIsPolling(false);
          setActionStatus({ type: 'error', message: data.message || 'Enrollment failed' });
        } else if (data.message) {
          setActionStatus({ type: 'processing', message: data.message });
        }
      } catch (error) {
        console.error('Polling error:', error);
      }
    }, 1000);
  };

  const handleDeleteFingerprint = async () => {
    try {
      setActionStatus({ type: 'processing', message: 'Deleting fingerprint...' });
      const token = getToken();

      const response = await fetch(`http://192.168.1.9:3001/api/fingerprint/${selectedEmployee.fingerprint_slot}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      const data = await response.json();

      if (response.ok && data.success) {
        setActionStatus({ type: 'success', message: 'Fingerprint deleted successfully!' });
        await fetchEmployeesWithFingerprints();
        
        setTimeout(() => {
          closeModal();
          setActionStatus({ type: '', message: '' });
        }, 2000);
      } else {
        throw new Error(data.error || `Server returned ${response.status}`);
      }
    } catch (error) {
      console.error('Delete error:', error);
      setActionStatus({ type: 'error', message: error.message || 'Failed to delete fingerprint' });
    }
  };

  const handleReenroll = async () => {
    try {
      setActionStatus({ type: 'processing', message: 'Deleting old fingerprint...' });
      const token = getToken();
      const oldSlot = selectedEmployee.fingerprint_slot;

      // Step 1: Delete old fingerprint from hardware and database
      const deleteResponse = await fetch(`http://192.168.1.9:3001/api/fingerprint/${oldSlot}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      const deleteData = await deleteResponse.json();

      if (!deleteResponse.ok || !deleteData.success) {
        throw new Error(deleteData.error || 'Failed to delete old fingerprint');
      }

      setActionStatus({ 
        type: 'processing', 
        message: 'Old fingerprint deleted. Starting new enrollment...' 
      });

      // Step 2: Wait a moment for hardware deletion to complete
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Step 3: Start new enrollment in the same slot
      const enrollResponse = await fetch('http://192.168.1.9:3001/api/fingerprint/enroll', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          employee_id: selectedEmployee.employee_id,
          slot: parseInt(oldSlot)
        })
      });

      const enrollData = await enrollResponse.json();

      if (enrollResponse.ok && enrollData.success) {
        setActionStatus({ 
          type: 'processing', 
          message: 'Ready for new fingerprint! Place finger on sensor...' 
        });
        setIsPolling(true);
        pollEnrollmentStatus(oldSlot);
      } else {
        throw new Error(enrollData.error || 'Failed to start new enrollment');
      }

    } catch (error) {
      console.error('Re-enroll error:', error);
      setActionStatus({ type: 'error', message: error.message || 'Failed to process re-enrollment' });
    }
  };

  const openModal = (employee, mode) => {
    setSelectedEmployee(employee);
    setModalMode(mode);
    setShowModal(true);
    setActionStatus({ type: '', message: '' });
    setEnrollSlot('');
    setAutoSlot(false);
  };

  const closeModal = () => {
    setShowModal(false);
    setSelectedEmployee(null);
    setActionStatus({ type: '', message: '' });
    setEnrollSlot('');
    setIsPolling(false);
    setAutoSlot(false);
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

        {/* Error Banner */}
        {actionStatus.type === 'error' && !showModal && (
          <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-xl flex items-center gap-3">
            <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0" />
            <div>
              <p className="text-red-800 font-medium">{actionStatus.message}</p>
              <button
                onClick={fetchEmployeesWithFingerprints}
                className="text-sm text-red-600 hover:text-red-700 mt-1 underline"
              >
                Try Again
              </button>
            </div>
          </div>
        )}

        {/* Search Bar */}
        <div className="mb-6">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input
              type="text"
              placeholder="Search by name or position..."
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
                          <>
                            <button
                              onClick={() => openModal(employee, 'reenroll')}
                              className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                              title="Re-enroll Fingerprint"
                            >
                              <RotateCcw className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => openModal(employee, 'delete')}
                              className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                              title="Delete Fingerprint"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </>
                        ) : (
                          <button
                            onClick={() => openModal(employee, 'enroll')}
                            className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-lg hover:from-indigo-700 hover:to-purple-700 transition-all text-sm font-medium"
                            title="Enroll Fingerprint"
                          >
                            <Plus className="w-4 h-4" />
                            Enroll
                          </button>
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

      {/* Modal */}
      {showModal && selectedEmployee && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
            <div className={`bg-gradient-to-r ${
              modalMode === 'delete' 
                ? 'from-red-600 to-pink-600' 
                : modalMode === 'enroll'
                ? 'from-indigo-600 to-purple-600'
                : 'from-blue-600 to-cyan-600'
            } p-6 text-white rounded-t-2xl`}>
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="text-xl font-bold mb-1">
                    {modalMode === 'delete' 
                      ? 'Delete Fingerprint' 
                      : modalMode === 'enroll'
                      ? 'Enroll Fingerprint'
                      : 'Re-enroll Fingerprint'}
                  </h3>
                  <p className="text-white/90 text-sm">
                    {selectedEmployee.fullname}
                  </p>
                </div>
                <button 
                  onClick={closeModal} 
                  className="text-white/80 hover:text-white"
                  disabled={isPolling}
                >
                  <X className="w-6 h-6" />
                </button>
              </div>
            </div>

            <div className="p-6 space-y-6">
              {actionStatus.type === '' && (
                <>
                  {modalMode === 'enroll' && (
                    <>
                      <div className="bg-indigo-50 border-indigo-200 p-4 rounded-xl border">
                        <p className="text-sm font-semibold text-indigo-900 mb-3">
                          🆕 New Fingerprint Enrollment
                        </p>
                        <div className="space-y-1 text-sm text-gray-700 bg-white bg-opacity-50 p-3 rounded">
                          <p><strong>Employee:</strong> {selectedEmployee.fullname}</p>
                          <p><strong>Position:</strong> {selectedEmployee.position}</p>
                          <p><strong>ID:</strong> {selectedEmployee.employee_id}</p>
                        </div>
                      </div>

                      {/* Auto Slot Toggle */}
                      <div className="flex items-center justify-between p-4 bg-gray-50 rounded-xl border border-gray-200">
                        <div className="flex items-center gap-3">
                          <input
                            type="checkbox"
                            id="autoSlot"
                            checked={autoSlot}
                            onChange={(e) => {
                              setAutoSlot(e.target.checked);
                              if (e.target.checked) {
                                const nextSlot = findFirstAvailableSlot();
                                if (nextSlot) {
                                  setEnrollSlot(nextSlot.toString());
                                }
                              } else {
                                setEnrollSlot('');
                              }
                            }}
                            className="w-5 h-5 text-indigo-600 rounded focus:ring-2 focus:ring-indigo-500"
                          />
                          <label htmlFor="autoSlot" className="text-sm font-medium text-gray-700 cursor-pointer">
                            Auto-assign first available slot
                          </label>
                        </div>
                        {autoSlot && enrollSlot && (
                          <span className="text-sm font-semibold text-indigo-600 bg-indigo-100 px-3 py-1 rounded-full">
                            Slot: {enrollSlot}
                          </span>
                        )}
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Fingerprint Slot (1-127)
                        </label>
                        <input
                          type="number"
                          min="1"
                          max="127"
                          value={enrollSlot}
                          onChange={(e) => setEnrollSlot(e.target.value)}
                          placeholder="Enter slot number"
                          disabled={autoSlot}
                          className={`w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent ${
                            autoSlot ? 'bg-gray-100 cursor-not-allowed' : ''
                          }`}
                        />
                        {autoSlot && (
                          <p className="text-xs text-gray-500 mt-1">
                            ✨ Auto mode enabled - slot will be assigned automatically
                          </p>
                        )}
                      </div>

                      <div className="bg-blue-50 border border-blue-200 rounded-xl p-3">
                        <p className="text-xs text-blue-800">
                          ℹ️ Make sure the fingerprint sensor is connected and employee is ready to scan
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
                          onClick={handleEnrollFingerprint}
                          disabled={!autoSlot && !enrollSlot}
                          className={`flex-1 px-4 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-xl font-semibold hover:from-indigo-700 hover:to-purple-700 transition-all ${
                            !autoSlot && !enrollSlot ? 'opacity-50 cursor-not-allowed' : ''
                          }`}
                        >
                          Start Enrollment
                        </button>
                      </div>
                    </>
                  )}

                  {modalMode === 'delete' && (
                    <>
                      <div className="bg-red-50 border-red-200 p-4 rounded-xl border">
                        <p className="text-sm font-semibold text-red-900 mb-3">
                          ⚠️ WARNING: This will delete the fingerprint
                        </p>
                        <div className="space-y-1 text-sm text-gray-700 bg-white bg-opacity-50 p-3 rounded">
                          <p><strong>Employee:</strong> {selectedEmployee.fullname}</p>
                          <p><strong>Slot:</strong> {selectedEmployee.fingerprint_slot}</p>
                          <p><strong>Registered:</strong> {selectedEmployee.registered_at || 'N/A'}</p>
                        </div>
                      </div>

                      <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-3">
                        <p className="text-xs text-yellow-800">
                          ℹ️ Employee will need to re-enroll through their dashboard
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
                          Delete Now
                        </button>
                      </div>
                    </>
                  )}

                  {modalMode === 'reenroll' && (
                    <>
                      <div className="bg-blue-50 border-blue-200 p-4 rounded-xl border">
                        <p className="text-sm font-semibold text-blue-900 mb-3">
                          🔄 This will allow employee to enroll again
                        </p>
                        <div className="space-y-1 text-sm text-gray-700 bg-white bg-opacity-50 p-3 rounded">
                          <p><strong>Employee:</strong> {selectedEmployee.fullname}</p>
                          <p><strong>Slot:</strong> {selectedEmployee.fingerprint_slot}</p>
                          <p><strong>Registered:</strong> {selectedEmployee.registered_at || 'N/A'}</p>
                        </div>
                      </div>

                      <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-3">
                        <p className="text-xs text-yellow-800">
                          ℹ️ Old fingerprint will be deleted from both database and hardware
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
                          onClick={handleReenroll}
                          className="flex-1 px-4 py-3 bg-gradient-to-r from-blue-600 to-cyan-600 text-white rounded-xl font-semibold hover:from-blue-700 hover:to-cyan-700 transition-all"
                        >
                          Re-enroll Now
                        </button>
                      </div>
                    </>
                  )}
                </>
              )}

              {actionStatus.type === 'processing' && (
                <div className="text-center py-8">
                  <RefreshCw className="w-16 h-16 text-indigo-600 mx-auto mb-4 animate-spin" />
                  <p className="text-gray-700 font-medium">{actionStatus.message}</p>
                  {isPolling && (
                    <p className="text-sm text-gray-500 mt-2">Please follow the sensor instructions...</p>
                  )}
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