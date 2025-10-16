import { HashRouter as Router, Routes, Route } from "react-router-dom";
import { ProtectedRoute } from "./component/utils/protectedRoute.jsx";
import Login from "./Login.jsx";
import MainLayout from "./component/layout/MainLayout.jsx";
import Dashboard from "./Dashboard.jsx";
import Employees from "./Employees.jsx";
import Auditing from "./Auditing.jsx";
import Salary from "./Salary.jsx";
import Incident from "./Incident.jsx";
import Reports from "./Reports.jsx";
import Scheduling from "./Scheduling.jsx";
import Attendance from "./Attendance.jsx";
import Approval from "./Approval.jsx";

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/login" element={<Login />} />

        {/* Everything under /app is protected */}
        <Route
          path="/"
          element={
            <ProtectedRoute>
              <MainLayout />
            </ProtectedRoute>
          }
        >
          <Route index element={<Dashboard />} />
          <Route path="dashboard" element={<Dashboard />} />
          <Route path="employee" element={<Employees />} />
          <Route path="audit" element={<Auditing />} />
          <Route path="salary" element={<Salary />} />
          <Route path="report" element={<Reports />} />
          <Route path="incident" element={<Incident />} />
          <Route path="schedule" element={<Scheduling />} />
          <Route path="attendance" element={<Attendance />} />
          <Route path="approval" element={<Approval />} />
        </Route>
      </Routes>
    </Router>
  );
}

export default App;
