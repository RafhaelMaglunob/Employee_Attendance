import { Navigate, useLocation } from "react-router-dom";
import Cookies from "js-cookie";

export function ProtectedEmployeeRoute({ children }) {
  const authToken = Cookies.get("auth_token");
  const location = useLocation(); // ✅ get current path

  if (!authToken && location.pathname !== "/employee-login") {
    // Clear localStorage related to employee
    localStorage.removeItem("employee-id");
    localStorage.removeItem("employeeButtonPath");
    localStorage.removeItem("employeeRole");
    localStorage.removeItem("employeeEmail");
    
    return <Navigate to="/employee-login" replace />;
  }

  if (authToken && location.pathname === "/employee-login") {
    return <Navigate to="/employee/dashboard" replace />;
  }

  return children;
}
