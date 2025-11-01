import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import { ProtectedRoute } from "./component/utils/protectedRoute.jsx";
import { ProtectedEmployeeRoute } from "./component/utils/protectedEmployeeRoute.jsx";
import { SocketProvider } from "./component/utils/SocketContext";

import { RedirectToBase } from "./component/utils/RedirectToBase.jsx";
import Login from "./Login.jsx";
import AdminLayout from "./component/layout/AdminLayout.jsx";
import EmployeeLayout from "./component/layout/EmployeeLayout.jsx";
import Dashboard from "./Dashboard.jsx";
import Employees from "./Employees.jsx";
import Auditing from "./Auditing.jsx";
import Salary from "./Salary.jsx";
import Incident from "./Incident.jsx";
import Scheduling from "./Scheduling.jsx";
import Attendance from "./Attendance.jsx";
import Approval from "./Approval.jsx";

import EmployeeLogin from "./EmployeeLogin.jsx";
import EmployeeDashboard from "./EmployeeDashboard.jsx";
import EmployeeReport from "./EmployeeReport.jsx";
import EmployeeNotification from "./EmployeeNotification.jsx";
import EmployeeSchedule from "./EmployeeSchedule.jsx";
import EmployeeDetails from "./EmployeeDetails.jsx";
import EmployeeDocuments from "./EmployeeDocuments.jsx";
import EmployeeSetting from "./EmployeeSetting.jsx";
import EmployeeIncident from "./EmployeeIncident.jsx";

function App() {
  return (
    <SocketProvider>
      <Router>
        <Routes>
          {/* Admin login */}
          <Route path="/login" element={<Login />} />

          {/* Admin protected routes */}
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <AdminLayout />
              </ProtectedRoute>
            }
          >
            <Route index element={<Dashboard />} />
            <Route path="dashboard" element={<Dashboard />} />
            <Route path="employees" element={<Employees />} />
            <Route path="audit" element={<Auditing />} />
            <Route path="salary" element={<Salary />} />
            <Route path="incident" element={<Incident />} />
            <Route path="schedule" element={<Scheduling />} />
            <Route path="attendance" element={<Attendance />} />
            <Route path="approval" element={<Approval />} />
          </Route>

          {/* Employee login */}
          <Route path="/employee-login" element={<EmployeeLogin />} />

          {/* Employee protected routes */}
          <Route
            path="/employee/*"
            element={
              <ProtectedEmployeeRoute>
                <EmployeeLayout />
              </ProtectedEmployeeRoute>
            }
          >
            <Route index element={<Navigate to="dashboard" replace />} />
            <Route path="dashboard" element={<EmployeeDashboard />} />
            <Route path="reports" element={<EmployeeReport />} />
            <Route path="notifications" element={<EmployeeNotification />} />
            <Route path="weekly-shift" element={<EmployeeSchedule />} />
            <Route path="more" element={<EmployeeDetails />} />
            <Route path="document" element={<EmployeeDocuments />} />
            <Route path="incident-reports" element={<EmployeeIncident />} />
            <Route path="setting" element={<EmployeeSetting />} />
          </Route>

          <Route path="*" element={<RedirectToBase />} />
        </Routes>
      </Router>
    </SocketProvider>
  );
}

export default App;