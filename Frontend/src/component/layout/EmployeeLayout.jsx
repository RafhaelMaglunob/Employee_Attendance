import { Outlet, useLocation, useNavigate } from "react-router-dom";
import Cookies from "js-cookie";
import { NavBar } from "./NavBar";
import { useState, useEffect, useRef } from "react";
import Headers from "../ui/header";
import { Sidebar } from "./Container";

export default function EmployeeLayout() {
	const userRole = localStorage.getItem("employeeRole")?.toLowerCase();
	const userEmail = localStorage.getItem("employeeEmail")?.toLowerCase();
	const navigate = useNavigate();
	const location = useLocation();
	const [showBottomNav, setShowBottomNav] = useState(true);
	const [sidebarOpen, setSidebarOpen] = useState(false);
	const bottomRef = useRef(null);

	const [path, setPath] = useState(() => {
		const saved = localStorage.getItem("employeePath");
		return saved || "Dashboard";
	});
	// Load currentPath from localStorage or default to current location
	const [currentPath, setCurrentPath] = useState(() => {
		const saved = localStorage.getItem("employeeButtonPath");
		return saved || location.pathname || "/employee/dashboard";
	});

	useEffect(() => {
		localStorage.setItem("employeePath", path);
	}, [path]);

	// Update localStorage whenever currentPath changes
	useEffect(() => {
		localStorage.setItem("employeeButtonPath", currentPath);
	}, [currentPath]);

	const handleButtonClick = (path, title) => {
		setPath(title);
		setCurrentPath(path);      
		navigate(path);             
	};

	const handleLogout = () => {
		Cookies.remove("auth_token");
		localStorage.removeItem("employee-id");
		localStorage.removeItem("employeeButtonPath");
		localStorage.removeItem("employeeRole");
		localStorage.removeItem("employeeEmail")
		window.location.href = "/employee-login";
	};

	// Hide bottom bar on scroll
	useEffect(() => {
		let lastScrollY = window.scrollY;
		const handleScroll = () => {
			if (window.scrollY > lastScrollY) setShowBottomNav(false);
			lastScrollY = window.scrollY;
		};
		window.addEventListener("scroll", handleScroll);
		return () => window.removeEventListener("scroll", handleScroll);
	}, []);

	// Show bottom nav on click/tap outside
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

	// Bottom navigation items with full paths
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
				<svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6 mb-1" fill="currentColor" viewBox="0 0 24 24">
					<path d="M12 24c1.104 0 2-.896 2-2h-4c0 1.104.896 2 2 2zm6-6V10c0-3.309-2.691-6-6-6S6 6.691 6 10v8l-2 2v1h16v-1l-2-2z" />
				</svg>
			),
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

			<div className="flex w-full">
				{/* Sidebar */}
				<Sidebar
					role={userRole}
					className={`fixed sm:sticky top-0 left-0 flex flex-col bg-black font-inter
						z-40 transform transition-transform duration-300
						md:w-20
						${sidebarOpen ? "translate-x-0" : "-translate-x-full"} 
						sm:translate-x-0 sm:flex flex-col items-start space-y-1 overflow-y-auto`}
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
									onClick={() => handleButtonClick(item.path, item.title)}
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

				{/* Page Content */}
				<main className="flex-1 md:ml-20 overflow-auto p-4 pb-20" onClick={() => setShowBottomNav(true)}>
					<Outlet  context={{ setPath, setCurrentPath }} />
				</main>
			</div>

			{/* Bottom NavBar for mobile */}
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
								onClick={() => handleButtonClick(item.path, item.title)}
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
		</div>
	);
}
