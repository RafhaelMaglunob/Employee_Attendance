import React, { useState, useEffect } from "react";
import { Card } from "../ui/card";
import { Button } from "../ui/button";
import { ModalContainer } from "../ui/modal";

export default function RenewContractModal({ isOpen, onClose, employeeId, updateData }) {
	const [startDate, setStartDate] = useState("");
	const [endDate, setEndDate] = useState("");
	const [contractType, setContractType] = useState("");
	const [statusType, setStatusType] = useState("");
	const [loading, setLoading] = useState(false);
	const [errors, setErrors] = useState({}); // now an object keyed by field

	// Live validation
	useEffect(() => {
		const validationErrors = {};

		const today = new Date();
		const start = new Date(startDate);
		const end = new Date(endDate);

		if (!contractType) validationErrors.contractType = "Contract type is required.";
		if (!statusType) validationErrors.statusType = "Status is required.";
		if (!startDate) validationErrors.startDate = "Start date is required.";
		if (!endDate && contractType?.toLowerCase() === "part-time") validationErrors.endDate = "End date is required.";

		if (startDate && start < new Date(today.toDateString())) validationErrors.startDate = "Start date cannot be in the past.";
		if (startDate && endDate && end <= start) validationErrors.endDate = "End date must be after start date.";

		const maxEnd = new Date(start);
		maxEnd.setMonth(maxEnd.getMonth() + 10); 
		if (startDate && endDate && end > maxEnd) validationErrors.endDate = "Contract length cannot exceed 10 months.";

		setErrors(validationErrors);
	}, [startDate, endDate, contractType, statusType]);

	if (!isOpen && !loading) return null;

	const handleRenew = () => {
		if (Object.keys(errors).length > 0) return;

		// Close modal immediately
		onClose();

		const bodyEndDate = contractType?.toLowerCase() === "full-time" ? null : endDate;
		const body = { 
			start_date: startDate, 
			end_date: bodyEndDate, 
			contract_type: contractType, 
			status: statusType 
		};

		// Fire-and-forget
		fetch(`http://localhost:3001/api/archive/${employeeId}`, {
			method: "PATCH",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify(body),
		})
		.then(res => res.json())
		.then(data => {
			updateData(prev =>
				prev.map(emp =>
					emp.employee_id === employeeId
						? { ...emp, contract_type: contractType, status: statusType, start_of_contract: startDate, end_of_contract: bodyEndDate }
						: emp
				)
			);
		})
		.catch(err => console.error("Renewal error:", err));

		// Clear form immediately
		setStartDate("");
		setEndDate("");
		setContractType("");
		setStatusType("");
		setErrors({});
	};



	return (
		<ModalContainer
			title={`Renew Contract`}
			titleSize="xl"
			variant="admin"
			onClose={onClose}
			disableOverlayClose={false}
		>
			<Card radius="none" className="bg-blue-100 shadow-none">
				<div className={`flex flex-col w-full relative space-y-4 ${loading ? "opacity-75" : ""}`}>
					<label className="text-sm">Employment Type</label>
					<select
						value={contractType}
						onChange={(e) => setContractType(e.target.value)}
						disabled={loading}
						className={`
							block w-full bg-white border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500
							${contractType === "" ? "text-gray-600" : "text-black"}
						`}
					>
						<option className="text-gray-600" value="" disabled>--Select Employment Type--</option>
						<option value="Full-time">Full-time</option>
						<option value="Part-time">Part-time</option>
					</select>
					{errors.contractType && <p className="text-red-700 text-sm mt-1">{errors.contractType}</p>}

					<label className="text-sm">Status</label>
					<select
						value={statusType}
						onChange={(e) => setStatusType(e.target.value)}
						disabled={loading}
						className="block w-full bg-white border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
					>
						<option className="text-gray-600" value="" disabled>--Select Status--</option>
						<option value="Employed">Employed</option>
						<option value="Probationary">Probationary</option>
					</select>
					{errors.statusType && <p className="text-red-700 text-sm mt-1">{errors.statusType}</p>}


					<label className="text-sm">Start Date *</label>
					<input
						type="date"
						value={startDate}
						onChange={(e) => setStartDate(e.target.value)}
						disabled={loading}
						className="block w-full bg-white border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
					/>
					{errors.startDate && <p className="text-red-700 text-sm mt-1">{errors.startDate}</p>}

					{contractType?.toLowerCase() === "part-time" && (
						<>
							<label className="text-sm">End Date *</label>
							<input
								type="date"
								value={endDate}
								onChange={(e) => setEndDate(e.target.value)}
								disabled={loading}
								className="block w-full bg-white border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
							/>
							{errors.endDate && <p className="text-red-700 text-sm mt-1">{errors.endDate}</p>}
						</>
					)}
					{errors.form && <p className="text-red-700 text-sm mt-1">{errors.form}</p>}
				</div>

				<div className="flex justify-end space-x-2 mt-4">
					<Button
						onClick={onClose}
						disabled={loading}
						className={`px-4 py-2 rounded ${loading ? "bg-gray-300 text-gray-600 cursor-not-allowed" : "bg-gray-300 hover:bg-gray-400"}`}
					>
						Cancel
					</Button>
					<Button
						onClick={handleRenew}
						disabled={loading || Object.keys(errors).length > 0}
						className={`px-4 py-2 text-white rounded ${loading ? "bg-blue-400 cursor-not-allowed" : "bg-blue-600 hover:bg-blue-700"}`}
					>
						{loading ? "Saving..." : "Confirm Renewal"}
					</Button>
				</div>
			</Card>
		</ModalContainer>
	);
}
