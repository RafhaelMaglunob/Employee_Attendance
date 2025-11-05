import React, { useState } from 'react';

export default function IncidentModal({
  showModal,
  setShowModal,
  selectedIncident,
  cancelDetail,
  closeDetail,
  formData,
  setFormData,
  handleSubmit,
  getStatusColor
}) {
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleChange = (e) => {
    setFormData(prev => ({
      ...prev,
      [e.target.name]: e.target.value
    }));
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return "-";
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  const onSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      await handleSubmit(e);
      setShowModal(false);
    } finally {
      setIsSubmitting(false);
    }
  };

  // New Incident Modal
  if (showModal) {
    return (
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
        <div className="bg-white rounded-lg max-w-md w-full p-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-bold">New Incident Report</h2>
            <button onClick={() => setShowModal(false)} className="text-2xl">&times;</button>
          </div>

          <form onSubmit={onSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1">Incident Type</label>
              <select
                name="incident_type"
                value={formData.incident_type}
                onChange={handleChange}
                required
                className="w-full border border-gray-300 rounded px-3 py-2"
              >
                <option value="">Select type...</option>
                <option value="Workplace Issue">Workplace Issue</option>
                <option value="Safety Concern">Safety Concern</option>
                <option value="Harassment">Harassment</option>
                <option value="Equipment Issue">Equipment Issue</option>
                <option value="Suggestion">Suggestion</option>
                <option value="Complaint">Complaint</option>
                <option value="Other">Other</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Incident Date</label>
              <input
                type="date"
                name="incident_date"
                value={formData.incident_date}
                onChange={handleChange}
                required
                className="w-full border border-gray-300 rounded px-3 py-2"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Witness (Optional)</label>
              <input
                type="text"
                name="witness"
                value={formData.witness}
                onChange={handleChange}
                placeholder="Name of witness"
                className="w-full border border-gray-300 rounded px-3 py-2"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Description</label>
              <textarea
                name="description"
                value={formData.description}
                onChange={handleChange}
                required
                rows="4"
                placeholder="Describe the incident..."
                className="w-full border border-gray-300 rounded px-3 py-2"
              />
            </div>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => cancelDetail(selectedIncident?.incident_id)}
                className="flex-1 bg-gray-300 text-black py-2 rounded"
                disabled={isSubmitting}
              >
                Cancel
              </button>
              <button
                type="submit"
                className={`flex-1 bg-black text-white py-2 rounded ${isSubmitting ? "bg-black/70" : ""}`}
                disabled={isSubmitting}
              >
                {isSubmitting ? 'Submitting...' : 'Submit'}
              </button>
            </div>
          </form>
        </div>
      </div>
    );
  }

  // Incident Detail Modal
  if (selectedIncident) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
        <div className="bg-white rounded-lg max-w-md w-full p-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-bold">Incident Details</h2>
            <button onClick={closeDetail} className="text-2xl">&times;</button>
          </div>

          <div className="space-y-3">
            <div>
              <p className="text-sm text-gray-600">Type</p>
              <p className="font-semibold">{selectedIncident.incident_type}</p>
            </div>

            <div>
              <p className="text-sm text-gray-600">Code</p>
              <p className="font-medium">INC-{String(selectedIncident.incident_id).padStart(3, '0')}</p>
            </div>

            <div>
              <p className="text-sm text-gray-600">Date</p>
              <p className="font-medium">{formatDate(selectedIncident.incident_date)}</p>
            </div>

            <div>
              <p className="text-sm text-gray-600">Status</p>
              <span className={`inline-block px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(selectedIncident.status)}`}>
                {selectedIncident.status}
              </span>
            </div>

            {selectedIncident.witness && (
              <div>
                <p className="text-sm text-gray-600">Witness</p>
                <p className="font-medium">{selectedIncident.witness}</p>
              </div>
            )}

            <div>
              <p className="text-sm text-gray-600">Description</p>
              <p className="text-sm">{selectedIncident.description}</p>
            </div>
          </div>

          <div className="flex gap-2 mt-4">
            <button
              onClick={cancelDetail}
              className="flex-1 bg-gray-300 text-black py-2 rounded"
              disabled={isSubmitting}
            >
              Cancel
            </button>
            <button
              onClick={closeDetail}
              className="flex-1 bg-black text-white py-2 rounded"
              disabled={isSubmitting}
            >
              Close
            </button>
          </div>
        </div>
      </div>
    );
  }

  return null;
}
