import { Navigate, useLocation } from "react-router-dom";
import Cookies from "js-cookie";

export function ProtectedRoute({ children }) {
  const location = useLocation();
  const authToken = Cookies.get("auth_token");

  // ✅ Not logged in → redirect to login
  if (!authToken && location.pathname !== "/login") {
    return <Navigate to="/login" replace />;
    
    const savedTab = (localStorage.getItem("employeeTab") || "employed").toLowerCase();
    const savedSort = localStorage.getItem("employeeSortTable") || "Filter";
  }

  // ✅ Already logged in → prevent returning to login page
  if (authToken && location.pathname === "/login") {
    return <Navigate to="/dashboard" replace />;
  }

  return children;
}
