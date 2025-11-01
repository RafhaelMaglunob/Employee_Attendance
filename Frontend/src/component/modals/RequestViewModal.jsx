// RequestViewModal.jsx
import React, { useEffect, useState } from "react";
import ConfirmModal from "./ConfirmModal";
import MessageModal from "./MessageModal";

function calculateLeaveDaysFromSchedule(startDate, endDate, schedule = []) {
	if (!startDate || !endDate || schedule.length === 0) return 0;

	const start = new Date(startDate);
	const end = new Date(endDate);

	return schedule.filter(d => {
		const sd = new Date(d.work_date);
		const sdStr = sd.toISOString().split("T")[0];
		const startStr = start.toISOString().split("T")[0];
		const endStr = end.toISOString().split("T")[0];
		return sdStr >= startStr && sdStr <= endStr;
	}).length;
}

const formatDate = (dateStr) => {
	if (!dateStr) return "";
	const date = new Date(dateStr);
	return date.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
};

export default function RequestViewModal({ isOpen, onClose, request }) {
	const [showConfirm, setShowConfirm] = useState(false);
	const [showPartial, setShowPartial] = useState(false);
	const [showDecline, setShowDecline] = useState(false);
	const [messageModal, setMessageModal] = useState({ isOpen: false, message: "", title: "" });
	const [partialData, setPartialData] = useState({ days: "", hours: "", remarks: "" });
	const [declineRemarks, setDeclineRemarks] = useState("");
	const [affectedDays, setAffectedDays] = useState(0);

	const formatDateForInput = (dateStr) => {
		if (!dateStr) return "";
		const d = new Date(dateStr);
		const month = `${d.getMonth() + 1}`.padStart(2, "0");
		const day = `${d.getDate()}`.padStart(2, "0");
		const year = d.getFullYear();
		return `${year}-${month}-${day}`;
	};

	useEffect(() => {
		if (request) {
			setPartialData({
				startDate: formatDateForInput(request.start_date),
				endDate: formatDateForInput(request.end_date),
				days: request.days || 1,
				hours: request.hours || "",
				remarks: ""
			});
		}
	}, [request]);

	// Check if request can be modified based on status
	const canModify = () => {
		const finalStatuses = ["approved", "rejected", "partial"];
		return !finalStatuses.includes(request?.status?.toLowerCase());
	};

	const getStatusMessage = () => {
		const status = request?.status?.toLowerCase();
		if (status === "approved") return "This request has already been approved.";
		if (status === "rejected") return "This request has already been rejected.";
		if (status === "partial") return "This request has already been partially approved.";
		return "";
	};

	const submitRequest = async (statusType, extraData = {}) => {
		try {
			const body = {
				status: statusType,
				remarks: extraData.remarks || "",
				days: extraData.days || null,
				hours: extraData.hours || null,
			};
			const res = await fetch(
				`http://localhost:3001/api/employee/requests/${request.request_type}/${request.request_id}`,
				{
					method: "PUT",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify(body),
				}
			);
			
			if (!res.ok) throw new Error("Failed to update request");
			return res.json();
		} catch (err) {
			console.error(err);
			setMessageModal({
				isOpen: true,
				title: "Error",
				message: "Something went wrong. Please try again.",
			});
			return false;
		}
	};

	const fetchAffectedDays = async () => {
		const { startDate, endDate } = partialData;
		if (!startDate || !endDate) return;

		try {
			const res = await fetch(
				`http://localhost:3001/api/employee/leave/${request.employee_id}?start=${startDate}&end=${endDate}`
			);
			const data = await res.json();
			setAffectedDays(data.days || 0);
		} catch (err) {
			console.error(err);
			setAffectedDays(0);
		}
	};

	const handleApprove = async () => {
		if (!canModify()) {
			setMessageModal({
				isOpen: true,
				title: "Cannot Approve",
				message: getStatusMessage(),
			});
			return;
		}

		setShowConfirm(false);
		const success = await submitRequest("approved");
		if (success) {
			setMessageModal({
				isOpen: true,
				title: "Request Approved",
				message: `${request.type} request approved successfully.`,
			});
		}
	};

	const handlePartialSubmit = async () => {
		if (!canModify()) {
			setMessageModal({
				isOpen: true,
				title: "Cannot Process",
				message: getStatusMessage(),
			});
			return;
		}

		if (
			(request.request_type === "leave" && !partialData.days) ||
			((request.request_type === "overtime" || request.request_type === "off-set") && !partialData.hours)
		) {
			return setMessageModal({
				isOpen: true,
				title: "Error",
				message: "Please fill in the required fields before submitting.",
			});
		}

		setShowPartial(false);
		const success = await submitRequest("partial", partialData);
		if (success) {
			setMessageModal({
				isOpen: true,
				title: "Partial Approval",
				message: `${request.type} request partially approved with remarks: ${partialData.remarks || "-"}`,
			});
		}
	};

	const handleDeclineSubmit = async () => {
		if (!canModify()) {
			setMessageModal({
				isOpen: true,
				title: "Cannot Decline",
				message: getStatusMessage(),
			});
			return;
		}

		setShowDecline(false);
		const success = await submitRequest("rejected", { remarks: declineRemarks });
		if (success) {
			setMessageModal({
				isOpen: true,
				title: "Request Declined",
				message: `${request.type} request declined with remarks: ${declineRemarks || "-"}`,
			});
		}
	};

	const handleMessageClose = () => {
		setMessageModal({ ...messageModal, isOpen: false });
		onClose();
	};

	const handlePartial = async () => {
		if (!canModify()) {
			setMessageModal({
				isOpen: true,
				title: "Cannot Process",
				message: getStatusMessage(),
			});
			return;
		}

		const startDate = formatDateForInput(request.start_date);
		const endDate = formatDateForInput(request.end_date);

		setPartialData({
			startDate,
			endDate,
			days: request.days || 1,
			hours: request.hours || "",
			remarks: "",
		});

		try {
			const res = await fetch(
				`http://localhost:3001/api/employee/leave/${request.employee_id}?start=${startDate}&end=${endDate}`
			);
			const data = await res.json();
			setAffectedDays(data.days || 0);
		} catch (err) {
			console.error(err);
			setAffectedDays(0);
		}

		setShowPartial(true);
	};

	const handleDecline = () => {
		if (!canModify()) {
			setMessageModal({
				isOpen: true,
				title: "Cannot Decline",
				message: getStatusMessage(),
			});
			return;
		}

		setDeclineRemarks("");
		setShowDecline(true);
	};

	const handleApproveClick = () => {
		if (!canModify()) {
			setMessageModal({
				isOpen: true,
				title: "Cannot Approve",
				message: getStatusMessage(),
			});
			return;
		}
		setShowConfirm(true);
	};

	if (!isOpen || !request) return null;

	const isDisabled = !canModify();

	return (
		<>
			{/* Main Modal */}
			<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
				<div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 border border-gray-200">
					<h2 className="text-xl font-semibold mb-4 border-b pb-2 text-gray-800">{request.type} Request Details</h2>
					
					{/* Status warning banner */}
					{isDisabled && (
						<div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
							<p className="text-sm text-yellow-800">
								⚠️ {getStatusMessage()}
							</p>
						</div>
					)}

					<div className="space-y-3 text-gray-700">
						<p><strong>Employee:</strong> {request.employee_name}</p>
						<p><strong>Status:</strong> <span className={`font-semibold ${
							request.status === "approved" ? "text-green-600" :
							request.status === "rejected" ? "text-red-600" :
							request.status === "partial" ? "text-yellow-600" :
							request.status === "in-review" ? "text-purple-600" :
							"text-blue-600"
						}`}>{request.status?.charAt(0).toUpperCase() + request.status?.slice(1)}</span></p>
						
						{request.request_type === "leave" && (
							<div>
								<p><strong>Duration:</strong> {formatDate(request.start_date)} - {formatDate(request.end_date)}</p>
								<p><strong>Affected Days:</strong> ({request.days} day's)</p>
							</div>
						)}
						{(request.request_type === "overtime" || request.request_type === "off-set") && (
							<p><strong>Requested Schedule:</strong> {formatDate(request.date)} ({request.hours} hour(s))</p>
						)}
						<p><strong>Reason:</strong> {request.reason || "-"}</p>
						{request.remarks && (
							<p><strong>Admin Remarks:</strong> {request.remarks}</p>
						)}
						{request.link && (
							<p>
								<strong>Link:</strong>{" "}
								<a href={request.link} target="_blank" rel="noopener noreferrer" className="text-blue-600 underline hover:text-blue-800">View</a>
							</p>
						)}
					</div>

					<div className="flex justify-end gap-3 mt-6">
						<button 
							className={`px-4 py-2 rounded-lg bg-red-500 text-white transition ${
								isDisabled ? "opacity-50 cursor-not-allowed" : "hover:bg-red-600"
							}`}
							onClick={handleDecline}
							disabled={isDisabled}
						>
							Decline
						</button>
						<button 
							className={`px-4 py-2 rounded-lg bg-yellow-500 text-white transition ${
								isDisabled ? "opacity-50 cursor-not-allowed" : "hover:bg-yellow-600"
							}`}
							onClick={handlePartial}
							disabled={isDisabled}
						>
							Partial
						</button>
						<button 
							className={`px-4 py-2 rounded-lg bg-green-600 text-white transition ${
								isDisabled ? "opacity-50 cursor-not-allowed" : "hover:bg-green-700"
							}`}
							onClick={handleApproveClick}
							disabled={isDisabled}
						>
							Approve
						</button>
						<button className="px-4 py-2 rounded-lg bg-gray-300 hover:bg-gray-400 transition" onClick={onClose}>Close</button>
					</div>
				</div>
			</div>

			{/* Confirm Modal */}
			{showConfirm && <ConfirmModal isOpen={showConfirm} message={`Are you sure you want to approve this ${request.type} request?`} onConfirm={handleApprove} onCancel={() => setShowConfirm(false)} />}

			{/* Partial Approval Modal */}
			{showPartial && (
				<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
					<div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full p-6 border border-gray-200">
						<h2 className="text-lg font-semibold mb-4 border-b pb-2">Partial Approval</h2>

						{request.request_type === "leave" && (
							<div className="mb-3">
								<label className="block text-sm font-medium mb-1">Select Dates to Approve</label>
								<div className="grid grid-cols-2 gap-2">
									<input type="date" value={partialData.startDate || ""} onChange={e => setPartialData(prev => ({ ...prev, startDate: e.target.value }))} onBlur={fetchAffectedDays} className="border px-4 py-2 rounded-lg" />
									<input type="date" value={partialData.endDate || ""} onChange={e => setPartialData(prev => ({ ...prev, endDate: e.target.value }))} onBlur={fetchAffectedDays} className="border px-4 py-2 rounded-lg" />
								</div>
								<p className="text-gray-500 mt-1">Total Days Affecting Schedule: {affectedDays}</p>
							</div>
						)}

						{(request.request_type === "overtime" || request.request_type === "off-set") && (
							<div className="mb-3">
								<label className="block text-sm font-medium mb-1">Limit Hours</label>
								<input type="number" min={1} max={8} value={partialData.hours} onChange={e => setPartialData({ ...partialData, hours: e.target.value })} className="w-full border rounded px-2 py-1" />
							</div>
						)}

						<div className="mb-3">
							<label className="block text-sm font-medium mb-1">Remarks</label>
							<textarea value={partialData.remarks} onChange={e => setPartialData({ ...partialData, remarks: e.target.value })} className="w-full border rounded px-2 py-1" />
						</div>

						<div className="flex justify-end gap-3">
							<button className="px-4 py-2 rounded bg-gray-300 hover:bg-gray-400 transition" onClick={() => setShowPartial(false)}>Cancel</button>
							<button className="px-4 py-2 rounded bg-yellow-500 text-white hover:bg-yellow-600 transition" onClick={handlePartialSubmit}>Submit</button>
						</div>
					</div>
				</div>
			)}

			{/* Decline Modal */}
			{showDecline && (
				<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
					<div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full p-6 border border-gray-200">
						<h2 className="text-lg font-semibold mb-4 border-b pb-2">Decline Request</h2>

						<div className="mb-3">
							<label className="block text-sm font-medium mb-1">Remarks</label>
							<textarea value={declineRemarks} onChange={e => setDeclineRemarks(e.target.value)} className="w-full border rounded px-2 py-1" />
						</div>

						<div className="flex justify-end gap-3">
							<button className="px-4 py-2 rounded bg-gray-300 hover:bg-gray-400 transition" onClick={() => setShowDecline(false)}>Cancel</button>
							<button className="px-4 py-2 rounded bg-red-500 text-white hover:bg-red-600 transition" onClick={handleDeclineSubmit}>Submit</button>
						</div>
					</div>
				</div>
			)}

			{/* Message Modal */}
			{messageModal.isOpen && <MessageModal isOpen={messageModal.isOpen} onClose={handleMessageClose} title={messageModal.title} message={messageModal.message} />}
		</>
	);
}