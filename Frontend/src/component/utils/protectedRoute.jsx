import { Navigate, useLocation } from "react-router-dom";
import Cookies from "js-cookie";

export function ProtectedRoute({ children }) {
  const location = useLocation();
  const authToken = Cookies.get("auth_token");

  // ✅ Not logged in → redirect to login
  if (!authToken && location.pathname !== "/login") {
    return <Navigate to="/login" replace />;
  }

  // ✅ Already logged in → prevent returning to login page
  if (authToken && location.pathname === "/login") {
    return <Navigate to="/app/dashboard" replace />;
  }

  return children;
}
