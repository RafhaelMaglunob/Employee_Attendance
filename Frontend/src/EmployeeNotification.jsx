import { useOutletContext, useNavigate } from "react-router-dom";
import { useState, useEffect } from "react";

function EmployeeNotification({ employeeId }) {
	const { setPath, setCurrentPath } = useOutletContext();
	const navigate = useNavigate();
	const [notifications, setNotifications] = useState([]);

	const handleSchedule = () => {
		setPath("Weekly Shift");
		setCurrentPath("/employee/weekly-shift");
		localStorage.setItem("employeePath", "Weekly Shift");
		localStorage.setItem("employeeButtonPath", "/employee/weekly-shift");
		navigate("/employee/weekly-shift");
	};

	useEffect(() => {
		const fetchApprovedRequests = async () => {
			try {
				const res = await fetch(`http://localhost:3001/api/employee/requests/${employeeId}`);
				if (!res.ok) throw new Error("Failed to fetch requests");
				const data = await res.json();
				if (data.success) {
					const filtered = data.data.filter(req => req.status === "approved" || req.status === "partial");
					setNotifications(filtered);
				}
			} catch (err) {
				console.error("Error fetching notifications:", err);
			}
		};

		fetchApprovedRequests();
	}, [employeeId]);

	const formatDate = (dateStr) => {
		const date = new Date(dateStr);
		return date.toLocaleDateString("en-US", { month: "short", day: "2-digit", year: "numeric" });
	};

	return (
		<div className="space-y-3">
			{/* Existing top notification */}
			<div className="flex flex-row gap-4 border-l-6 rounded-md border-[#5E451D] px-3 py-4 bg-[#FFF1C8]">
				<img src="../img/Notification.png" alt="Notification" className="w-7 h-8" />
				<div>
					<p className="font-inter text-[#5E451D]">
						<span className="text-lg font-semibold block">Set Availability for next week</span>
						<span className="text-md block">
							Part-time staff: Please submit your availability for next week by Friday
						</span>
					</p>
					<button
						onClick={handleSchedule}
						className="bg-[#5E451D] text-white py-1 px-4 rounded-[50px] mt-2"
					>
						Set Now
					</button>
				</div>
			</div>

			{/* Approved / Partial requests */}
			<div className="space-y-3">
				{notifications.map(req => {
					const displayDate = req.request_type === "leave"
						? req.start_date === req.end_date
							? formatDate(req.start_date)
							: `${formatDate(req.start_date)} - ${formatDate(req.end_date)}`
						: formatDate(req.date);

					return (
						<div
							key={req.request_id}
							className="flex flex-row gap-4 border-l-6 rounded-md border-[#5E451D] px-3 py-4 bg-[#FFF1C8]"
						>
							<img src="../img/Notification.png" alt="Notification" className="w-7 h-8" />
							<div>
								<p className="font-inter text-[#5E451D]">
									<span className="text-lg font-semibold block">{req.type} Approved</span>
									<span className="text-md block">
										Your {req.type.toLowerCase()} request for {displayDate} has been {req.status}.
									</span>
								</p>
								{req.request_type === "shift" && (
									<button
										onClick={handleSchedule}
										className="bg-[#5E451D] text-white py-1 px-4 rounded-[50px] mt-2"
									>
										View Schedule
									</button>
								)}
							</div>
						</div>
					);
				})}
			</div>
		</div>
	);
}

export default EmployeeNotification;
