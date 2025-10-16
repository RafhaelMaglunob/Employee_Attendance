import { Navigate } from "react-router-dom";
import Cookies from "js-cookie";

export function ProtectedEmployeeRoute({ children }) {
  const authToken = Cookies.get("auth_token");

  if (!authToken) {
    return <Navigate to="/employee-login" replace />;
  }

  return children;
}
