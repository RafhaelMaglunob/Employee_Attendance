import { useOutletContext, useNavigate } from "react-router-dom";
import { useState, useEffect } from "react";

function EmployeeNotification() {
	const { setPath, setCurrentPath, setNotifCount, employeeId } = useOutletContext();
	const navigate = useNavigate();
	const [notifications, setNotifications] = useState([]);

	const handleSchedule = () => {
		setPath("Weekly Shift");
		setCurrentPath("/employee/weekly-shift");
		localStorage.setItem("employeePath", "Weekly Shift");
		localStorage.setItem("employeeButtonPath", "/employee/weekly-shift");
		navigate("/employee/weekly-shift");
	};

	const formatDate = (dateStr) => {
		const date = new Date(dateStr);
		return date.toLocaleDateString("en-US", { month: "short", day: "2-digit", year: "numeric" });
	};

	useEffect(() => {
		const fetchNotifications = async () => {
			const employeeId = localStorage.getItem("employeeId");
			if (!employeeId) return;

			try {
				const res = await fetch(`http://localhost:3001/api/employee/all-request/${employeeId}`);
				if (!res.ok) throw new Error("Failed to fetch notifications");
				const data = await res.json();

				let notifs = [];
				if (data.success) notifs = data.data;

				// Add "Set Availability" notification on Friday
				const today = new Date();
				if (today.getDay() === 5) { // Friday
					notifs = [
						{
							request_id: "availability-friday",
							type: "Set Availability",
							status: "today",
							request_type: "availability",
							date: today.toISOString(),
						},
						...notifs,
					];
				}

				setNotifCount(prev => prev === 0 ? 0 : notifs.length);
				if (setNotifCount) setNotifCount(0);
			} catch (err) {
				console.error("Error fetching notifications:", err);
			}
		};

		fetchNotifications();
	}, [setNotifCount]);

	const statusColors = {
		approved: "bg-green-100 text-green-800",
		pending: "bg-yellow-100 text-yellow-800",
		rejected: "bg-red-100 text-red-800",
		today: "bg-blue-100 text-blue-800",
	};

	return (
		<div className="space-y-3">
			<div className="flex flex-row gap-4 border-l-6 rounded-md border-[#5E451D] px-3 py-4 bg-[#FFF1C8]">
				<img src="../img/Notification.png" alt="Notification" className="w-7 h-8" />
				<div>
					<p className="font-inter text-[#5E451D]">
						<span className="text-lg font-semibold block">
							Set Availability for next week
						</span>
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

			{notifications.length > 0 ? (
				<div className="space-y-3">
					{notifications.map((req) => {
						const displayDate =
							req.request_type === "leave"
								? req.start_date === req.end_date
									? formatDate(req.start_date)
									: `${formatDate(req.start_date)} - ${formatDate(req.end_date)}`
								: formatDate(req.date);

						const statusLabel =
							req.status?.charAt(0).toUpperCase() + req.status?.slice(1) || "Unknown";

						return (
							<div
								key={req.request_id}
								className="border px-5 py-4 rounded-lg mb-2 shadow-sm flex justify-between items-start cursor-pointer hover:bg-gray-50"
							>
								<div>
									<p className="text-xl font-semibold">{req.type}</p>
									<p className="text-gray-700">{displayDate}</p>
									{req.request_type === "shift" && (
										<button
											onClick={handleSchedule}
											className="bg-[#5E451D] text-white py-1 px-4 rounded-[50px] mt-2"
										>
											View Schedule
										</button>
									)}
								</div>
								<span
									className={`px-3 py-1 rounded-full font-medium ${statusColors[req.status] || "bg-gray-100 text-gray-800"}`}
								>
									{statusLabel}
								</span>
							</div>
						);
					})}
				</div>
			) : (
				<p className="text-gray-500 font-inter">No notifications yet.</p>
			)}
		</div>
	);
}

export default EmployeeNotification;
