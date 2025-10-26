import React, { useState } from "react";
import { Card } from "../ui/card";
import { Button } from "../ui/button";
import { Filter } from "../ui/filter";
import { ModalContainer } from "../ui/modal";

export default function DeleteEmployeeModal({ isOpen, onClose, employeeId, updateData }) {
	const [statusType, setStatusType] = useState("Termination");
	const [deletionDate, setDeletionDate] = useState("");
	const [loading, setLoading] = useState(false);
	const [errors, setErrors] = useState([]);

	// ✅ Keep modal open regardless of parent rerender while loading
	if (!isOpen && !loading) return null;

	const handleDelete = async () => {
		const validationErrors = [];
		if (!deletionDate) validationErrors.push("Please select a deletion date.");
		if (validationErrors.length > 0) {
			setErrors(validationErrors);
			return;
		}

		setLoading(true);
		setErrors([]);

		try {
			const status = statusType === "Termination" ? "Termination" : "Resignation";

			const res = await fetch(`http://localhost:3001/api/employees/${employeeId}`, {
				method: "PATCH",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ status, deletion_date: deletionDate }),
			});

			const data = await res.json();
			if (!res.ok) throw new Error(data.message || "Failed to update employee");

			await new Promise((resolve) => setTimeout(resolve, 500)); // ✅ small delay to ensure UI updates cleanly

			updateData((prev) =>
				prev.map((emp) =>
					emp.employee_id === employeeId
						? { ...emp, status, effective_deletion_date: deletionDate }
						: emp
				)
			);

			setLoading(false); // mark done first
			onClose(); // then close cleanly
		} catch (err) {
			console.error("Failed to update employee:", err);
			setErrors([err.message || "Failed to update employee"]);
			setLoading(false);
		}
	};

	return (
		<ModalContainer
			title={`Employee ${statusType}`}
			titleSize="xl"
			variant="admin"
			onClose={!loading ? onClose : undefined}
			disableOverlayClose={loading}
		>
			<Card radius="none" className="bg-yellow-400 shadow-none">
				<div className={`flex flex-col w-full relative space-y-4 ${loading ? "opacity-75" : ""}`}>
					<label className="text-sm mb-1">Status Change Type</label>
					<Filter className="flex flex-row text-black" noIcon={true} value={statusType}>
						<Button
							onClick={() => setStatusType("Termination")}
							disabled={loading}
							className="w-full text-left px-3 py-2 hover:bg-gray-200"
						>
							Termination
						</Button>
						<Button
							onClick={() => setStatusType("Resignation")}
							disabled={loading}
							className="w-full text-left px-3 py-2 hover:bg-gray-200"
						>
							Resignation
						</Button>
					</Filter>

					<label className="text-sm mb-1">Effective Deletion Date *</label>
					<input
						type="date"
						value={deletionDate}
						onChange={(e) => setDeletionDate(e.target.value)}
						disabled={loading}
						className="block w-full bg-white border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-200"
					/>

					{errors.length > 0 && (
						<ul className="text-red-700 mt-1 list-disc list-inside">
							{errors.map((err, idx) => (
								<li key={idx}>{err}</li>
							))}
						</ul>
					)}
				</div>

				<div className="flex justify-end space-x-2 mt-4">
					<Button
						onClick={onClose}
						disabled={loading}
						className={`px-4 py-2 rounded ${
							loading
								? "bg-gray-300 text-gray-600 cursor-not-allowed"
								: "bg-gray-300 hover:bg-gray-400"
						}`}
					>
						Cancel
					</Button>
					<Button
						onClick={handleDelete}
						disabled={!deletionDate || loading}
						className={`px-4 py-2 text-white rounded ${
							loading || !deletionDate
								? "bg-red-400 cursor-not-allowed"
								: "bg-red-600 hover:bg-red-700"
						}`}
					>
						{loading ? "Saving..." : `Confirm ${statusType}`}
					</Button>
				</div>
			</Card>
		</ModalContainer>
	);
}
