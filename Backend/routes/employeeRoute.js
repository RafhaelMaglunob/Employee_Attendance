import { employeeController } from "../controllers/employeeController.js";
import { employeeDashboardController } from "../controllers/employeeDashboardController.js";
export async function employeeRoutes(fastify, options) {
    const io = options.io;
    const controller = employeeController(fastify.pg, io);
    const dashboardController = employeeDashboardController(fastify.pg);

    fastify.get("/employees", controller.getAllEmployees);
    fastify.get("/employees/:id", controller.getSingleEmployee);
    fastify.get("/employees/contract/:id", controller.getSingleEmployeeContract);
    fastify.post("/employees", controller.addEmployee);
    fastify.put("/employees/:id", controller.updateEmployee);
    fastify.patch("/employees/:id", controller.deleteEmployee);
    fastify.get("/employees/requests", controller.getAllEmployeeRequests);
    fastify.put("/employee/requests/:type/:requestId", controller.updateEmployeeRequest);
    fastify.get('/fingerprint/attendance', controller.getFingerprintAttendance);
    fastify.get('/fingerprint/attendance/:date', controller.getFingerprintAttendanceByDate);

    fastify.get('/employee/schedule/:employeeId/dashboard', dashboardController.getEmployeeSchedule);
    fastify.get('/employee/time-logs/:employeeId/dashboard', dashboardController.getEmployeeTimeLogs);
    fastify.get('/employee/weekly-summary/:employeeId/dashboard', dashboardController.getWeeklySummary);
    fastify.post('/employee/clock-in/dashboard', dashboardController.clockIn);
    fastify.post('/employee/clock-out/dashboard', dashboardController.clockOut);
    fastify.post('/employee/break-start/dashboard', dashboardController.startBreak);
    fastify.post('/employee/break-end/dashboard', dashboardController.endBreak);

}
