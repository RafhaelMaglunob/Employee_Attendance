import { Outlet, useLocation, useNavigate } from "react-router-dom";
import Cookies from "js-cookie";
import { NavBar } from "./NavBar";
import { useState, useEffect, useRef, useCallback } from "react";
import Headers from "../ui/header";
import { Sidebar } from "./Container";
import ChangePasswordModal from "../modals/ChangePasswordModal.jsx";
import ConfirmModal from "../modals/ConfirmModal";
import MessageModal from "../modals/MessageModal";
import { useSocket } from "../utils/SocketContext";

export default function EmployeeLayout() {
	const [showChangePassword, setShowChangePassword] = useState(false);
	const [confirmOpen, setConfirmOpen] = useState(false);
	const [messageOpen, setMessageOpen] = useState(false);
	const [messageText, setMessageText] = useState("");
	const [notificationCount, setNotificationCount] = useState(0);
	const [showBottomNav, setShowBottomNav] = useState(true);
	const [sidebarOpen, setSidebarOpen] = useState(false);
	const [path, setPath] = useState(() => localStorage.getItem("employeePath") || "Dashboard");
	const [currentPath, setCurrentPath] = useState(() => localStorage.getItem("employeeButtonPath") || "/employee/dashboard");
	const bottomRef = useRef(null);

	const userRole = localStorage.getItem("employeeRole")?.toLowerCase();
	const userEmail = localStorage.getItem("employeeEmail")?.toLowerCase();
	const employeeId = localStorage.getItem("employeeId");
	const isFirstLogin = localStorage.getItem("isFirstLogin");
	const { socket, isConnected } = useSocket();
	const navigate = useNavigate();
	const location = useLocation();

	// ----------------- Fetch Notification Count -----------------
	const fetchNotificationCount = useCallback(async () => {
		const employeeId = localStorage.getItem("employeeId");
		if (!employeeId) return;
		try {
			const res = await fetch(`http://192.168.1.9:3001/api/employee/notification/${employeeId}`);
			const data = await res.json();
			if (data.success) setNotificationCount(data.count);
		} catch (err) {
			console.error("Failed to fetch notification count:", err);
		}
	}, []);

	useEffect(() => {
		if (!socket) return;

		const handleNotificationUpdate = (data) => {
			console.log("🔔 Notification received:", data);
			setNotificationCount(data.count);
			
			// Optional: Show a toast notification
			// You can add a toast library or custom notification popup here
		};

		socket.on("notificationCountUpdated", handleNotificationUpdate);

		return () => {
			socket.off("notificationCountUpdated", handleNotificationUpdate);
		};
	}, [socket]);

	// ----------------- First Login Check -----------------
	useEffect(() => {
		if (isFirstLogin === "true") {
			setShowChangePassword(true);
		}
	}, [isFirstLogin]);

	// ----------------- Save Path / Current Path -----------------
	useEffect(() => {
		localStorage.setItem("employeePath", path);
	}, [path]);

	useEffect(() => {
		localStorage.setItem("employeeButtonPath", currentPath);
	}, [currentPath]);

	// ----------------- Fetch Notification Count on Mount -----------------
	useEffect(() => {
		fetchNotificationCount();
	}, [fetchNotificationCount]);

	// ----------------- Hide/Show Bottom Nav -----------------
	useEffect(() => {
		let lastScrollY = window.scrollY;
		const handleScroll = () => {
			if (window.scrollY > lastScrollY) setShowBottomNav(false);
			lastScrollY = window.scrollY;
		};
		window.addEventListener("scroll", handleScroll);
		return () => window.removeEventListener("scroll", handleScroll);
	}, []);

	useEffect(() => {
		const showNav = (e) => {
			if (!bottomRef.current) return;
			if (!bottomRef.current.contains(e.target)) setShowBottomNav(true);
		};
		document.addEventListener("click", showNav);
		document.addEventListener("touchstart", showNav);
		return () => {
			document.removeEventListener("click", showNav);
			document.removeEventListener("touchstart", showNav);
		};
	}, []);

	// ----------------- Handlers -----------------
	const handleButtonClick = (path, title) => {
		setPath(title);
		setCurrentPath(path);
		navigate(path);
	};

	const handleLogout = () => {
		Cookies.remove("employee_token");
		localStorage.removeItem("employeeId");
		localStorage.removeItem("employeeButtonPath");
		localStorage.removeItem("employeeRole");
		localStorage.removeItem("employeeEmail");
		navigate("/employee-login");
	};

	const handleChangePasswordSubmit = async ({ oldPassword, newPassword }) => {
		const token = Cookies.get("employee_token");
		if (!token) {
			handleLogout();
			return;
		}

		setConfirmOpen(true);

		const confirm = await new Promise((resolve) => {
			const interval = setInterval(() => {
				if (window.__confirmResult !== undefined) {
					clearInterval(interval);
					const result = window.__confirmResult;
					window.__confirmResult = undefined;
					resolve(result);
				}
			}, 100);
		});

		if (!confirm) return;

		try {
			const res = await fetch("http://192.168.1.9:3001/api/employee/change-password", {
				method: "PUT",
				headers: {
					"Content-Type": "application/json",
					Authorization: `Bearer ${token}`,
				},
				body: JSON.stringify({ oldPassword, newPassword }),
			});
			const data = await res.json();

			if (data.success) {
				setMessageText("✅ Your password has been successfully changed.");
				setMessageOpen(true);
				setShowChangePassword(false);
				localStorage.removeItem("isFirstLogin");
			} else {
				setMessageText(data.error || "❌ Failed to change password.");
				setMessageOpen(true);
			}
		} catch (err) {
			setMessageText("⚠️ Server error. Please try again.");
			setMessageOpen(true);
		}
	};

	const handleResetNotificationCount = async () => {
		const employeeId = localStorage.getItem("employeeId");
		if (!employeeId) return;

		try {
			const res = await fetch(`http://192.168.1.9:3001/api/employee/notification/reset/${employeeId}`, {
				method: "PUT",
			});
			const data = await res.json();
			if (data.success) setNotificationCount(0);
		} catch (err) {
			console.error("Failed to reset notification count:", err);
		}
	};

	// ----------------- Bottom Navigation Items -----------------
	const bottomNavItems = [
		{
			label: "Home",
			title: "Dashboard",
			path: "/employee/dashboard",
			icon: (
				<svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6 mb-1" fill="currentColor" viewBox="0 0 24 24">
					<path d="M3 12l9-9 9 9v9a3 3 0 0 1-3 3h-3v-6h-6v6H6a3 3 0 0 1-3-3v-9z" />
				</svg>
			),
		},
		{
			label: "Reports",
			title: "Reports",
			path: "/employee/reports",
			icon: (
				<svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6 mb-1" fill="currentColor" viewBox="0 0 24 24">
					<path d="M3 3h18v2H3V3zm0 4h18v2H3V7zm0 4h12v2H3v-2zm0 4h12v2H3v-2zm0 4h18v2H3v-2z" />
				</svg>
			),
		},
		{
			label: "Notifications",
			title: "Notifications",
			path: "/employee/notifications",
			icon: (
				<div className="relative">
					<svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6 mb-1" fill="currentColor" viewBox="0 0 24 24">
						<path d="M12 24c1.104 0 2-.896 2-2h-4c0 1.104.896 2 2 2zm6-6V10c0-3.309-2.691-6-6-6S6 6.691 6 10v8l-2 2v1h16v-1l-2-2z" />
					</svg>
					{notificationCount > 0 && (
						<span className="absolute -top-1 -right-2 bg-red-600 text-white text-xs w-4 h-4 flex items-center justify-center rounded-full">
							{notificationCount}
						</span>
					)}
				</div>
			),
			onClick: handleResetNotificationCount,
		},
		{
			label: "More",
			title: "More",
			path: "/employee/more",
			icon: (
				<svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6 mb-1" fill="currentColor" viewBox="0 0 24 24">
					<circle cx="5" cy="12" r="2" />
					<circle cx="12" cy="12" r="2" />
					<circle cx="19" cy="12" r="2" />
				</svg>
			),
		},
	];

	return (
		<div className="min-h-screen flex flex-col overflow-x-hidden">
			{/* Top NavBar */}
			<NavBar className="flex relative z-40 items-center border-b-2 border-b-[#5E451D] font-inter px-4 py-2">
				<div className="w-full flex justify-between items-center">
					<img src="../img/TheCrunchLogoSnoBG 1.png" className="w-auto object-contain" alt="Logo" />
					<h1 className="text-xl font-bold">{path}</h1>
					<div className="flex flex-row items-center space-x-4 relative">
						<img src="../img/Notification.png" alt="Notification Icon" className="w-5 h-5" />
						<Headers userRole={userRole} userEmail={userEmail} onLogout={handleLogout}>
							<img src="../img/UserProfile.png" alt="Profile Icon" className="w-5 h-5 rounded-full" />
						</Headers>
					</div>
				</div>
			</NavBar>

			{/* Sidebar + Main */}
			<div className="flex w-full">
				<Sidebar
					role={userRole}
					className={`fixed sm:sticky top-0 left-0 flex flex-col bg-black font-inter z-40 transform transition-transform duration-300 md:w-20 ${
						sidebarOpen ? "translate-x-0" : "-translate-x-full"
					} sm:translate-x-0 sm:flex flex-col items-start space-y-1 overflow-y-auto`}
				>
					<div className="flex items-center justify-between w-full px-2 py-4">
						<img src="../img/TheCrunchLogoSnoBG 1.png" className="w-auto h-10 object-contain" />
						<button
							className={`${sidebarOpen ? "flex" : "hidden"} flex sm:hidden text-xl p-1`}
							onClick={() => setSidebarOpen(!sidebarOpen)}
						>
							X
						</button>
					</div>

					<div className="flex flex-col w-full px-2 space-y-4">
						{bottomNavItems.map((item) => {
							const isActive = currentPath === item.path;
							return (
								<button
									key={item.label}
									onClick={() => {
										handleButtonClick(item.path, item.title);
										if (item.onClick) item.onClick();
									}}
									className={`flex flex-col items-center justify-center py-2 px-2 rounded-xl ${
										isActive ? "text-yellow-500" : "text-white"
									} hover:text-yellow-500`}
								>
									<span>{item.icon}</span>
									<p className="text-xs mt-1">{item.label}</p>
								</button>
							);
						})}
					</div>
				</Sidebar>

				<main className="flex-1 md:ml-20 overflow-auto p-4 pb-20" onClick={() => setShowBottomNav(true)}>
					<Outlet context={{ setPath, setCurrentPath, handleLogout, employeeId }} />
				</main>
			</div>

			{/* Bottom NavBar Mobile */}
			<NavBar
				ref={bottomRef}
				className={`fixed md:hidden bottom-0 left-0 right-0 z-40 flex items-center border-t-2 border-t-[#5E451D] font-inter bg-black px-4 py-4 transform transition-transform duration-300 ${
					showBottomNav ? "translate-y-0" : "translate-y-full"
				}`}
			>
				<div className="w-full max-w-full flex justify-between px-4 mx-auto">
					{bottomNavItems.map((item) => {
						const isActive = currentPath === item.path;
						return (
							<button
								key={item.label}
								onClick={() => {
									handleButtonClick(item.path, item.title);
									if (item.onClick) item.onClick();
								}}
								className={`flex flex-col items-center justify-center py-2 px-2 rounded-xl ${
									isActive ? "text-yellow-500" : "text-white"
								} hover:text-yellow-500`}
							>
								<span>{item.icon}</span>
								<p className="text-xs mt-1">{item.label}</p>
							</button>
						);
					})}
				</div>
			</NavBar>

			{/* Modals */}
			{showChangePassword && (
				<ChangePasswordModal
					isOpen={showChangePassword}
					onClose={() => {
						setShowChangePassword(false);
						localStorage.removeItem("isFirstLogin");
					}}
					onSubmit={handleChangePasswordSubmit}
				/>
			)}

			<ConfirmModal
				isOpen={confirmOpen}
				title="Confirm Password Change"
				message="Are you sure you want to change your password?"
				onConfirm={() => {
					window.__confirmResult = true;
					setConfirmOpen(false);
				}}
				onCancel={() => {
					window.__confirmResult = false;
					setConfirmOpen(false);
				}}
			/>

			<MessageModal
				isOpen={messageOpen}
				message={messageText}
				onClose={() => setMessageOpen(false)}
			/>
		</div>
	);
}
