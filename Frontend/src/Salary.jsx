    import { useState, useMemo } from 'react'
    import { Button } from './component/ui/button'
    import { Card } from './component/ui/card'
    import { Table } from './component/data/table'
    import { useFetchData } from './component/hooks/useFetchData'
    import { exportTableToPdf } from './component/utils/exportablePdf'
    import ViewHourTrackerModal from './component/modals/viewHourTrackerModal'

    function Salary() {
        const [selectedEmployee, setSelectedEmployee] = useState(null);
        const [isViewOpen, setIsViewOpen] = useState(false);

        // Fetch work logs
        const transformEmployeeWorkLogs = (emp) => ({
            employee_id: emp.employee_id,
            name: emp.employee_name,
            work_date: emp.work_date,
            period: emp.pay_period, // Use API-provided pay period
            days_worked: emp.days_worked,
            hours_worked: emp.total_hours
        });

        const { data, loading } = useFetchData(
            `http://192.168.1.9:3001/api/total-work-logs`,
            transformEmployeeWorkLogs
        );

        const { data: employees } = useFetchData(
            'http://192.168.1.9:3001/api/employees',
            emp => ({ employee_id: emp.employee_id, name: emp.fullname })
        );

        const { data: payPeriods } = useFetchData(
            'http://192.168.1.9:3001/api/employee-pay-periods',
            p => ({
                employee_id: p.employee_id,
                start_date: p.start_date,
                end_date: p.end_date
            })
        );

        // Filter logs for selected employee
        const employeeLogs = useMemo(() => {
            if (!selectedEmployee) return [];
            return data.filter(log => log.employee_id === selectedEmployee.employee_id);
        }, [data, selectedEmployee]);

        // Compute total hours and days
        const totalHours = useMemo(() =>
            employeeLogs.reduce((sum, log) => sum + Number(log.hours_worked || 0), 0),
            [employeeLogs]
        );

        const totalDays = useMemo(() =>
            employeeLogs.reduce((sum, log) => sum + Number(log.days_worked || 0), 0),
            [employeeLogs]
        );

        const payPeriodRange = useMemo(() => {
            if (!selectedEmployee || !payPeriods) return '-';
            const period = payPeriods.find(p => p.employee_id === selectedEmployee.employee_id);
            if (!period) return '-';

            const options = { month: 'short', day: '2-digit', year: 'numeric' };
            const start = new Date(period.start_date).toLocaleDateString('en-US', options);
            const end = new Date(period.end_date).toLocaleDateString('en-US', options);

            return `${start} – ${end}`;
        }, [selectedEmployee, payPeriods]);

        
        const handleView = (row) => {
            setSelectedEmployee(row);
            setIsViewOpen(true);
        };

        const columns = [
            { key: "name", title: "Employee" },
            { key: "period", title: "Period" }, // Use period from API
            { key: "days_worked", title: "Days" },
            { key: "hours_worked", title: "Hours" },
            { key: "actions", title: "Actions", render: (row) => (
                <Button onClick={() => handleView(row)} className="rounded-[50px] hover:bg-black/20 w-10 h-10">
                    View
                </Button>
            )}
        ];

        if (loading) return <p className="text-gray-400 text-xl">Loading...</p>;

        return (
            <div className="pb-7">
                {/* Top Bar */}
                <div className="flex justify-between items-center mb-5 mt-3 mr-3">
                    <h1 className="font-bold text-2xl">Employee Hours Tracker</h1>
                    <div className="flex space-x-3">
                        <Button 
                            onClick={() => exportTableToPdf(columns, filteredData, `audit_logs_${new Date().toISOString()}.docx`)}
                            className="bg-black text-white px-3 py-2 rounded-xl flex items-center hover:bg-black/70"
                        >
                            <img src="../img/Export_Icon.png" alt="Export" className="w-5 h-5 mr-2 invert" />
                            Export Report
                        </Button>
                    </div>
                </div>

                {/* Main Card */}
                <Card title="Record Hours Worked" titleSize="lg" radius="none" variant="admin" width="full">
                    <div className="flex flex-wrap gap-4 mt-2 w-full">
                        {/* Left */}
                        <div className="flex flex-1 flex-col space-y-3">
                            <label className="text-xs">Select Employee</label>
                            <select
                                className="w-full bg-white border-2 rounded-lg px-3 py-2"
                                value={selectedEmployee?.employee_id || ""}
                                onChange={(e) =>
                                    setSelectedEmployee(employees.find(emp => emp.employee_id === e.target.value))
                                }
                            >
                                <option>--Select Employee--</option>
                                {employees.map(emp => (
                                    <option key={emp.employee_id} value={emp.employee_id}>{emp.name}</option>
                                ))}
                            </select>

                            <label className="text-xs">Pay Period</label>
                            <span className="px-4 py-2 rounded-lg bg-white border-2 font-semibold">
                                {payPeriodRange}
                            </span>

                            <div className="flex gap-4">
                                <div className="flex-1 flex flex-col">
                                    <label className="text-xs">Days Worked</label>
                                    <span className="px-4 py-2 rounded-lg bg-white border-2 font-semibold">{totalDays}</span>
                                </div>
                                <div className="flex-1 flex flex-col">
                                    <label className="text-xs">Hours Worked</label>
                                    <span className="px-4 py-2 rounded-lg bg-white border-2 font-semibold">{totalHours}</span>
                                </div>
                            </div>

                            <Button 
                                onClick={() => setSelectedEmployee(null)}
                                className="mt-3 bg-black text-white py-2 rounded-lg"
                            >Clear</Button>
                        </div>

                        {/* Right */}
                        <div className="flex flex-1">
                            <div className="bg-white rounded-lg p-6 shadow-md w-full flex flex-col items-center justify-center">
                                <span className="text-5xl font-bold">{totalHours}</span>
                                <span className="text-sm text-gray-500 mt-1">Total Hours Recorded</span>
                                <span className="text-sm text-gray-500 mt-1 font-semibold">{employeeLogs.length} Pay Periods</span>
                                <img src="../../img/Clock_Icon.png" alt="Clock Icon" className="w-10 h-10 mt-4"/>
                            </div>
                        </div>
                    </div>
                </Card>

                {/* Table */}
                <Card radius="none" variant="admin" width="full" className="mt-7">
                    <Table columns={columns} data={data} className="text-black" />
                </Card>
                
                {selectedEmployee && (
                    <ViewHourTrackerModal
                        isOpen={isViewOpen}
                        onClose={() => setIsViewOpen(false)}
                        hoursTrackerId={selectedEmployee?.employee_id}
                        hourTrackerPeriod={selectedEmployee?.period} 
                    />


                )}

            </div>
        )
    }

    export default Salary;
