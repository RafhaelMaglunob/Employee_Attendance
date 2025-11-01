import { useOutletContext, useNavigate } from "react-router-dom";
import { useState, useEffect } from "react";

function EmployeeNotification() {
	const { setPath, setCurrentPath, employeeId } = useOutletContext();
	const navigate = useNavigate();
	const [notifications, setNotifications] = useState([]);
	const [loading, setLoading] = useState(true);
	console.log(employeeId)
	const handleSchedule = () => {
		setPath("Weekly Shift");
		setCurrentPath("/employee/weekly-shift");
		localStorage.setItem("employeePath", "Weekly Shift");
		localStorage.setItem("employeeButtonPath", "/employee/weekly-shift");
		navigate("/employee/weekly-shift");
	};

	const formatDate = (dateStr) => {
		if (!dateStr) return "";
		const date = new Date(dateStr);
		return date.toLocaleDateString("en-US", { month: "short", day: "2-digit", year: "numeric" });
	};

	const formatDateTime = (dateStr) => {
		if (!dateStr) return "";
		const date = new Date(dateStr);
		return date.toLocaleString("en-US", { 
			month: "short", 
			day: "2-digit", 
			year: "numeric",
			hour: "2-digit",
			minute: "2-digit"
		});
	};

	useEffect(() => {
		fetchNotifications();
	}, []);

	const fetchNotifications = async () => {
		try {
			setLoading(true);
			const res = await fetch(`http://localhost:3001/api/employee/notifications/${employeeId}`);
			const data = await res.json();
			if (data.success) {
				setNotifications(data.notifications);
			}
			console.log(data)
		} catch (err) {
			console.error("Failed to fetch notifications:", err);
		} finally {
			setLoading(false);
		}
	};

	const markAsRead = async (notificationId) => {
		try {
			await fetch(`http://localhost:3001/api/employee/notifications/${notificationId}/read`, {
				method: "PUT"
			});
			
			// Update local state
			setNotifications(prev =>
				prev.map(n => n.id === notificationId ? { ...n, is_read: true } : n)
			);
		} catch (err) {
			console.error("Failed to mark as read:", err);
		}
	};

	const getNotificationIcon = (type) => {
		const icons = {
			leave: "📅",
			overtime: "⏰",
			"off-set": "🔄",
			schedule: "📋",
			incident: "⚠️",
		};
		return icons[type] || "📬";
	};

	const getActionColor = (action) => {
		const colors = {
			approved: "text-green-600",
			rejected: "text-red-600",
			partial: "text-yellow-600",
			cancelled: "text-gray-600",
			submitted: "text-blue-600",
			updated: "text-purple-600",
		};
		return colors[action?.toLowerCase()] || "text-gray-600";
	};

	if (loading) {
		return (
			<div className="flex items-center justify-center h-64">
				<p className="text-gray-500">Loading notifications...</p>
			</div>
		);
	}

	return (
		<div className="space-y-4">
			{/* Weekly Availability Banner */}
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
						className="bg-[#5E451D] text-white py-1 px-4 rounded-[50px] mt-2 hover:bg-[#4a3416] transition"
					>
						Set Now
					</button>
				</div>
			</div>

			{/* Notifications List */}
			<div>
				<h2 className="text-xl font-semibold mb-3">Recent Notifications</h2>
				
				{notifications.length === 0 ? (
					<div className="text-center py-12">
						<p className="text-gray-500 text-lg">📭 No notifications yet</p>
						<p className="text-gray-400 text-sm mt-2">
							You'll see updates about your requests here
						</p>
					</div>
				) : (
					<div className="space-y-3">
						{notifications.map((notif) => (
							<div
								key={notif.id}
								onClick={() => !notif.is_read && markAsRead(notif.id)}
								className={`p-4 rounded-lg border transition cursor-pointer ${
									notif.is_read 
										? "bg-white border-gray-200 hover:bg-gray-50" 
										: "bg-blue-50 border-blue-300 hover:bg-blue-100"
								}`}
							>
								<div className="flex items-start gap-3">
									{/* Icon */}
									<div className="text-2xl flex-shrink-0">
										{getNotificationIcon(notif.type)}
									</div>

									{/* Content */}
									<div className="flex-1 min-w-0">
										<div className="flex items-start justify-between gap-2">
											<p className={`text-sm ${
												notif.is_read ? "text-gray-700" : "font-semibold text-gray-900"
											}`}>
												{notif.message}
											</p>
											
											{/* Unread indicator */}
											{!notif.is_read && (
												<span className="w-2 h-2 bg-blue-500 rounded-full flex-shrink-0 mt-1"></span>
											)}
										</div>

										{/* Timestamp and Type Badge */}
										<div className="flex items-center gap-2 mt-2 flex-wrap">
											<span className="text-xs text-gray-500">
												{formatDateTime(notif.created_at)}
											</span>
											
											{notif.type && (
												<span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">
													{notif.type}
												</span>
											)}
											
											{notif.action && (
												<span className={`text-xs font-medium ${getActionColor(notif.action)}`}>
													{notif.action.charAt(0).toUpperCase() + notif.action.slice(1)}
												</span>
											)}
										</div>
									</div>
								</div>
							</div>
						))}
					</div>
				)}
			</div>

			{/* Clear All Read Notifications (Optional) */}
			{notifications.some(n => n.is_read) && (
				<div className="text-center pt-4">
					<button
						onClick={async () => {
							try {
								await fetch(`http://localhost:3001/api/employee/notifications/${employeeId}/clear-read`, {
									method: "DELETE"
								});
								setNotifications(prev => prev.filter(n => !n.is_read));
							} catch (err) {
								console.error("Failed to clear notifications:", err);
							}
						}}
						className="text-sm text-gray-500 hover:text-gray-700 underline"
					>
						Clear read notifications
					</button>
				</div>
			)}
		</div>
	);
}

export default EmployeeNotification;