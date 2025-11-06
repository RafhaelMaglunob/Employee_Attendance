import { Navigate, useLocation } from "react-router-dom";
import Cookies from "js-cookie";

export function ProtectedRoute({ children }) {
  const location = useLocation();
  const authToken = Cookies.get("admin_token");

  // ✅ Not logged in → redirect to login
  if (!authToken && location.pathname !== "/login") {
    return <Navigate to="/login" replace />;
  }

  // ✅ Already logged in → no need to see login page
  if (authToken && location.pathname === "/login") {
    return <Navigate to="/dashboard" replace />;
  }

  return children;
}
