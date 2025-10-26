import { useLocation, Navigate } from "react-router-dom";

export function RedirectToBase() {
  const location = useLocation();

  // If path starts with /employee, redirect to /employee-login
  if (location.pathname.startsWith("/employee")) {
    return <Navigate to="/employee-login" replace />;
  }

  // Otherwise redirect to admin login
  return <Navigate to="/login" replace />;
}
