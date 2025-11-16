import React, { useState } from 'react';

function CertificateViewModal({ isOpen, certificate, onClose, onApprove, onReject }) {
  const [remarks, setRemarks] = useState('');
  const [loading, setLoading] = useState(false);

  if (!isOpen || !certificate) return null;

  const handleApprove = async () => {
    if (!window.confirm('Approve this certificate request? PDF will be generated and sent to employee.')) return;

    setLoading(true);
    try {
      const res = await fetch(
        `http://192.168.1.9:3001/api/admin/certificate/${certificate.certificate_id}/approve`,
        {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${localStorage.getItem('admin_token')}`
          },
          body: JSON.stringify({
            approvedBy: localStorage.getItem('employeeId'),
            remarks: remarks
          })
        }
      );

      const data = await res.json();
      if (data.success) {
        alert('✅ Certificate approved! PDF has been generated and emailed to employee.');
        onApprove();
      } else {
        alert('❌ Failed to approve certificate: ' + data.message);
      }
    } catch (err) {
      alert('❌ Error approving certificate');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleReject = async () => {
    const reason = window.prompt('Enter rejection reason:');
    if (!reason) return;

    setLoading(true);
    try {
      const res = await fetch(
        `http://192.168.1.9:3001/api/admin/certificate/${certificate.certificate_id}/reject`,
        {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${localStorage.getItem('admin_token')}`
          },
          body: JSON.stringify({
            rejectedBy: localStorage.getItem('employeeId'),
            remarks: reason
          })
        }
      );

      const data = await res.json();
      if (data.success) {
        alert('Certificate request rejected');
        onReject();
      } else {
        alert('Failed to reject certificate');
      }
    } catch (err) {
      alert('Error rejecting certificate');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="bg-blue-600 text-white p-6 rounded-t-lg">
          <div className="flex justify-between items-start">
            <div>
              <h2 className="text-2xl font-bold">Certificate Request</h2>
              <p className="text-blue-100 mt-1">Review and approve employee certificate</p>
            </div>
            <button
              onClick={onClose}
              className="text-white hover:text-gray-200 text-2xl font-bold"
            >
              ×
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Employee Info */}
          <div className="bg-gray-50 p-4 rounded-lg">
            <h3 className="font-semibold text-lg mb-3">Employee Information</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-gray-600">Full Name</p>
                <p className="font-semibold">{certificate.fullname}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Employee ID</p>
                <p className="font-semibold">{certificate.employee_id}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Position</p>
                <p className="font-semibold">{certificate.position}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Employment Type</p>
                <p className="font-semibold">{certificate.employment_type}</p>
              </div>
            </div>
          </div>

          {/* Request Details */}
          <div className="bg-blue-50 p-4 rounded-lg">
            <h3 className="font-semibold text-lg mb-3">Request Details</h3>
            <div className="space-y-3">
              <div>
                <p className="text-sm text-gray-600">Purpose</p>
                <p className="font-semibold text-blue-900">{certificate.purpose}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Request Date</p>
                <p className="font-semibold">
                  {new Date(certificate.request_date).toLocaleDateString('en-US', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit'
                  })}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Status</p>
                <span className={`inline-block px-3 py-1 rounded-full text-sm font-semibold ${
                  certificate.status === 'Approved' ? 'bg-green-100 text-green-800' :
                  certificate.status === 'Rejected' ? 'bg-red-100 text-red-800' :
                  'bg-yellow-100 text-yellow-800'
                }`}>
                  {certificate.status}
                </span>
              </div>
            </div>
          </div>

          {/* Admin Remarks */}
          {certificate.status === 'Pending' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Remarks (Optional)
              </label>
              <textarea
                value={remarks}
                onChange={(e) => setRemarks(e.target.value)}
                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                rows="3"
                placeholder="Add any notes or comments..."
              />
            </div>
          )}

          {/* Previous Remarks (if rejected) */}
          {certificate.remarks && certificate.status !== 'Pending' && (
            <div className="bg-gray-50 p-4 rounded-lg">
              <p className="text-sm text-gray-600 mb-1">Remarks</p>
              <p className="text-gray-800">{certificate.remarks}</p>
            </div>
          )}
        </div>

        {/* Footer - Action Buttons */}
        {certificate.status === 'Pending' && (
          <div className="bg-gray-50 p-6 rounded-b-lg flex gap-3 justify-end">
            <button
              onClick={onClose}
              disabled={loading}
              className="px-6 py-2 border border-gray-300 rounded-lg hover:bg-gray-100 font-semibold disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              onClick={handleReject}
              disabled={loading}
              className="px-6 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 font-semibold disabled:opacity-50"
            >
              {loading ? 'Processing...' : 'Reject'}
            </button>
            <button
              onClick={handleApprove}
              disabled={loading}
              className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 font-semibold disabled:opacity-50"
            >
              {loading ? 'Processing...' : 'Approve & Generate PDF'}
            </button>
          </div>
        )}

        {/* If already processed, just show close button */}
        {certificate.status !== 'Pending' && (
          <div className="bg-gray-50 p-6 rounded-b-lg flex justify-end">
            <button
              onClick={onClose}
              className="px-6 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 font-semibold"
            >
              Close
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default CertificateViewModal;