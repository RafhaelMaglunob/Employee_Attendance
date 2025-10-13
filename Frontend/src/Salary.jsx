import { useState } from 'react'
import { Button } from './component/ui/button'
import { Card } from './component/ui/card'
import { Table } from './component/data/table'
import { useFetchData } from './component/hooks/useFetchData'

function Salary() {
    const [selectedEmployee, setSelectedEmployee] = useState(null);

    const transformEmployee = (emp) => ({
        employee_id: emp.employee_id,
        name: emp.fullname,
        period: emp.period,
        day: emp.day,
        hour: emp.hour,
    });

    const { data: employees, loading } = useFetchData(
        `http://localhost:3001/api/employees`,
        transformEmployee
    );

    const columns = [
        { key: "employee", title: "Employee" },
        { key: "period", title: "Period" },
        { key: "day", title: "Days" },
        { key: "hour", title: "Hours" },
        {
            key: "actions",
            title: "Actions",
            render: row => {
                return (
                    <div className="flex gap-2">
                        <Button onClick={handleView(row)} className="rounded-[50px] hover:bg-black/20 w-10 h-10">
                            View
                        </Button>
                    </div>
                );
            }
        }
    ]

    return (
        <div>
            {/*Top Bar*/}
            <div className="flex justify-between items-center mb-3 mt-3 mr-3">
                <h1 className="font-bold text-2xl">Employee Hours Tracker</h1>
                <div className="flex justify-between space-x-3">
                    <div className="flex items-center px-2 py-1 bg-white w-30 sm:w-auto rounded-xl cursor-pointer hover:bg-black/10 border">
                        <img src="../img/Print_Icon.png" alt="Print Icon" className="w-5 h-5 mr-2" />
                        <Button
                            onClick={() => exportTableToWord(columns, filteredData, `audit_logs_${new Date().toISOString()}.docx`)}
                            className="font-bold rounded-xl text-sm px-1 py-1"
                        >
                            Print
                        </Button>
                    </div>
                    <div className="flex items-center px-2 py-1 bg-black rounded-xl cursor-pointer hover:bg-black/70">
                        <img src="../img/Export_Icon.png" alt="Export Icon" className="w-5 h-5 mr-2 invert" />
                        <Button
                            onClick={() => exportTableToWord(columns, filteredData, `audit_logs_${new Date().toISOString()}.docx`)}
                            className="text-white font-bold text-sm px-2 py-1"
                        >
                            Export Report
                        </Button>
                    </div>
                </div>
            </div>

            {/* Card */}
            <Card title="Record Hours Worked" titleSize="lg" radius="none" variant="admin" width="full">
                <div className="flex flex-wrap gap-4 mt-2 w-full">
                    {/* Left */}
                    <div className="flex flex-1 flex-col space-y-3">
                        <label className="mb-1 text-xs">Select Employee</label>
                        <div className="flex flex-col">
                            <select
                                className="w-full bg-white border-2 rounded-lg px-3 py-2"
                                value={selectedEmployee?.employee_id || ""}
                                onChange={(e) => {
                                    const emp = employees.find(emp => emp.employee_id === e.target.value);
                                    setSelectedEmployee(emp);
                                }}
                            >
                                <option>--Select Employee--</option>
                                {employees.map(emp => (
                                    <option key={emp.employee_id} value={emp.employee_id}>
                                    {emp.name}
                                    </option>
                                ))}
                            </select>
                        </div>

                        <label className="mb-1 text-xs">Pay Period</label>
                        <span className="px-4 py-2 rounded-lg bg-white border-2 outline-none w-full">
                            {selectedEmployee?.pay_period || "-"}
                        </span>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="flex flex-col">
                                <label className="mb-1 text-xs">Days Worked</label>
                                <span className="px-4 rounded-lg bg-white border-2 outline-none py-1">
                                    {selectedEmployee?.days_worked ?? "-"}
                                </span>
                            </div>
                            <div className="flex flex-col">
                                <label className="mb-1 text-xs">Hours Worked</label>
                                <span className="px-4 rounded-lg bg-white border-2 outline-none py-1">
                                    {selectedEmployee?.hours_worked ?? "-"}
                                </span>
                            </div>
                        </div>

                        <Button className="mt-3 bg-black text-white py-2 rounded-lg">Save Hours</Button>
                    </div>

                    {/* Right Card */}
                    <div className="flex flex-1">
                        <div className="bg-white rounded-lg p-6 shadow-md w-full flex flex-col items-center justify-center">
                            <span className="text-5xl font-bold text-center">
                                {selectedEmployee?.hours_worked ?? 0}
                            </span>
                            <span className="text-sm text-gray-500 mt-1">Hours to be recorded</span>
                            <span className="text-sm text-gray-500 mt-1 font-semibold">
                                {selectedEmployee?.days_worked ?? 0} Days
                            </span>
                            <div className="mt-4">
                                <img src="../../img/Clock_Icon.png" alt="Clock Icon" className="w-10 h-10" />
                            </div>
                        </div>
                    </div>
                </div>
            </Card>
            <Card radius="none" variant="admin" width="full" className="mt-5">
                <Table columns={columns} data={""} >

                </Table>
            </Card>
        </div>
    )
}

export default Salary
