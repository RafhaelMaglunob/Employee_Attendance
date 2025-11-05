import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import IncidentModal from './component/modals/IncidentModal';
import { useSocket } from './component/utils/SocketContext';

export default function EmployeeIncident() {
  const navigate = useNavigate();
  const employeeId = localStorage.getItem("employeeId");
  const { socket, isConnected } = useSocket();

  const [incidents, setIncidents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [selectedIncident, setSelectedIncident] = useState(null);

  const [formData, setFormData] = useState({
    incident_type: '',
    incident_date: '',
    witness: '',
    description: ''
  });

  useEffect(() => {
    fetchIncidents();
  }, [employeeId]);

  useEffect(() => {
    if (!socket || !isConnected) {
      console.log("⏳ Waiting for socket connection...");
      return;
    }

    console.log("🔌 Setting up incident socket listeners");

    const handleIncidentUpdate = (updatedIncident) => {
      console.log("📨 Incident updated:", updatedIncident);
      fetchIncidents();
    };

    const handleIncidentDelete = (deletedIncident) => {
      console.log("🗑️ Incident deleted:", deletedIncident);
      fetchIncidents();
      if (selectedIncident?.incident_id === deletedIncident.incident_id) {
        setSelectedIncident(null);
      }
    };

    const handleIncidentCreate = (newIncident) => {
      console.log("✨ New incident created:", newIncident);
      fetchIncidents();
    };

    socket.on('incidentUpdated', handleIncidentUpdate);
    socket.on('incidentDeleted', handleIncidentDelete);
    socket.on('incidentCreated', handleIncidentCreate);

    return () => {
      console.log("🧹 Cleaning up incident socket listeners");
      socket.off('incidentUpdated', handleIncidentUpdate);
      socket.off('incidentDeleted', handleIncidentDelete);
      socket.off('incidentCreated', handleIncidentCreate);
    };
  }, [socket, isConnected, selectedIncident]);

  const fetchIncidents = async () => {
    setLoading(true);
    try {
      const res = await fetch(`http://localhost:3001/api/employee/${employeeId}/incidents`);
      const data = await res.json();
      if (data.success) setIncidents(data.data);
    } catch (err) {
      console.error('Error fetching incidents:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch('http://localhost:3001/api/incidents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          employee_id: employeeId,
          reported_by: employeeId
        })
      });

      const data = await res.json();
      if (data.success) {
        alert('Incident report submitted successfully!');
        setShowModal(false);
        setFormData({ incident_type: '', incident_date: '', witness: '', description: '' });
        // Socket will trigger refetch automatically
      } else {
        alert(data.message || 'Failed to submit incident report');
      }
    } catch (err) {
      console.error('Error submitting incident:', err);
      alert('Error submitting incident report');
    }
  };

  const viewIncident = (incident) => setSelectedIncident(incident);
  const closeDetail = () => setSelectedIncident(null);
  
  const handleDeleteIncident = async (incidentId) => {
    if (!window.confirm("Are you sure you want to delete this incident?")) return;

    try {
      const res = await fetch(`http://localhost:3001/api/incidents/${incidentId}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
      });

      const data = await res.json();
      if (data.success) {
        console.log("✅ Incident deleted successfully");
        // Socket will trigger refetch automatically
        setSelectedIncident(null);
      } else {
        alert(data.message || "Failed to delete incident");
      }
    } catch (err) {
      console.error("Error deleting incident:", err);
      alert("Error deleting incident");
    }
  };

  const getStatusConfig = (status) => {
    const configs = {
      'Pending': {
        bg: 'bg-yellow-100',
        text: 'text-yellow-800',
        border: 'border-yellow-300',
        icon: '⏳'
      },
      'Reviewed': {
        bg: 'bg-blue-100',
        text: 'text-blue-800',
        border: 'border-blue-300',
        icon: '👁️'
      },
      'Resolved': {
        bg: 'bg-green-100',
        text: 'text-green-800',
        border: 'border-green-300',
        icon: '✅'
      },
      'Dismissed': {
        bg: 'bg-gray-100',
        text: 'text-gray-800',
        border: 'border-gray-300',
        icon: '❌'
      }
    };
    return configs[status] || {
      bg: 'bg-gray-100',
      text: 'text-gray-800',
      border: 'border-gray-300',
      icon: '📋'
    };
  };

  if (loading) {
    return (
      <div className="font-sans text-black min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading incidents...</p>
        </div>
      </div>
    );
  }

  // Calculate stats
  const pendingIncidents = incidents.filter(i => i.status === 'Pending').length;
  const resolvedIncidents = incidents.filter(i => i.status === 'Resolved').length;
  const totalIncidents = incidents.length;

  return (
    <div className="font-sans flex flex-col text-black min-h-screen pb-20 bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b sticky top-0 z-10">
        <div
          onClick={() => navigate(-1)}
          className="flex w-fit items-center gap-2 text-sm cursor-pointer px-4 py-4 hover:bg-gray-100 rounded transition"
        >
          <span className="text-xl">&#60;</span>
          <p className="font-semibold">Incident Reports</p>
        </div>
      </div>

      <div className="p-4">
        {/* Stats Cards */}
        <div className="grid grid-cols-3 gap-3 mb-6">
          <div className="bg-white rounded-lg p-4 shadow-sm border border-gray-200">
            <div className="text-2xl font-bold text-gray-900">{totalIncidents}</div>
            <div className="text-xs text-gray-600 mt-1">Total Reports</div>
          </div>
          <div className="bg-yellow-50 rounded-lg p-4 shadow-sm border border-yellow-200">
            <div className="text-2xl font-bold text-yellow-800">{pendingIncidents}</div>
            <div className="text-xs text-yellow-700 mt-1">Pending</div>
          </div>
          <div className="bg-green-50 rounded-lg p-4 shadow-sm border border-green-200">
            <div className="text-2xl font-bold text-green-800">{resolvedIncidents}</div>
            <div className="text-xs text-green-700 mt-1">Resolved</div>
          </div>
        </div>

        {/* New Report Button */}
        <button 
          onClick={() => setShowModal(true)}
          className="bg-black text-white rounded-lg py-3 px-6 w-full flex justify-center items-center gap-2 hover:bg-gray-800 transition shadow-md mb-6 font-medium"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          New Incident Report
        </button>

        {/* Incident List */}
        <div>
          <h3 className="font-semibold text-lg mb-3">Recent Incidents</h3>
          
          {incidents.length === 0 ? (
            <div className="text-center py-12 bg-white rounded-lg border-2 border-dashed border-gray-300">
              <svg className="w-16 h-16 text-gray-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <p className="text-gray-600 text-lg font-medium">No incident reports yet</p>
              <p className="text-gray-500 mt-2">Click the button above to create your first report</p>
            </div>
          ) : (
            <div className="space-y-3">
              {incidents.map((item) => {
                const statusConfig = getStatusConfig(item.status);
                return (
                  <div
                    key={item.incident_id}
                    onClick={() => viewIncident(item)}
                    className="bg-white border border-gray-200 rounded-lg p-4 cursor-pointer hover:shadow-md transition-all"
                  >
                    <div className="flex justify-between items-start mb-3">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <span className="text-lg">⚠️</span>
                          <h4 className="font-semibold text-lg">{item.incident_type}</h4>
                        </div>
                        <div className="flex items-center gap-2 text-sm text-gray-600">
                          <span className="font-mono text-xs bg-gray-100 px-2 py-1 rounded">
                            INC-{String(item.incident_id).padStart(3, '0')}
                          </span>
                          <span>•</span>
                          <span>{new Date(item.incident_date).toLocaleDateString('en-US', { 
                            month: 'short', 
                            day: 'numeric',
                            year: 'numeric'
                          })}</span>
                        </div>
                      </div>
                      <span className={`px-3 py-1 rounded-full text-xs font-semibold border ${statusConfig.bg} ${statusConfig.text} ${statusConfig.border} flex items-center gap-1`}>
                        <span>{statusConfig.icon}</span>
                        {item.status}
                      </span>
                    </div>

                    {item.description && (
                      <p className="text-sm text-gray-600 line-clamp-2 mb-2">
                        {item.description}
                      </p>
                    )}

                    <div className="flex items-center justify-between text-xs text-gray-500 pt-2 border-t border-gray-100">
                      <span>
                        {item.witness ? `Witness: ${item.witness}` : 'No witnesses'}
                      </span>
                      <span className="text-blue-600 font-medium">View Details →</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Incident Modal */}
      <IncidentModal
        showModal={showModal}
        setShowModal={setShowModal}
        selectedIncident={selectedIncident}
        closeDetail={closeDetail}
        cancelDetail={handleDeleteIncident}
        formData={formData}
        setFormData={setFormData}
        handleSubmit={handleSubmit}
        getStatusColor={(status) => {
          const config = getStatusConfig(status);
          return `${config.bg} ${config.text}`;
        }}
      />
    </div>
  );
}