import React from 'react'
import { Card } from './component/ui/card'
import { Table } from './component/data/table'

const columns = [
  { key: "type", title: "Type" },
  { key: "employee", title: "Employee" },
  { key: "status", title: "Status" },
  { key: "time", title: "Time"},
];

const data = [
  { type: "Leave Request", employee: "Ryan", status: "Approved", time: "4 hours ago" },
  { type: "Overtime", employee: "Althea", status: "Pending", time: "3 hours ago" },
  { type: "Schedule Change", employee: "July", status: "Rejected", time: "5 hours ago" },
  { type: "Attendance", employee: "Arlene", status: "Late", time: "Today, 9:15 AM" },
];


function Dashboard() {
    return (
        <div className="pb-10">
            <h1 className="text-2xl font-bold text-gray-800">Dashboard</h1>
            <p className="text-md text-gray-500">Welcome to the Employee Management System</p>

            {/* Cards */}
            <div className="flex flex-wrap gap-4 mt-2 w-full">
                <div className="flex flex-1 min-w-[300px]">
                    <Card
                        title="Attendance Summary"
                        variant="admin"
                        radius="none"
                        className="flex-1 shadow-[8px_8px_0_#5E451D]"
                    >
                        <div className="flex justify-around items-center flex-1 mt-4">
                            <div className="flex flex-col items-center">
                                <img src="..\img\Present.png" alt="Present" className="h-15 w-15" />
                                <span className="text-2xl font-semibold mt-2">42</span>
                                <span className="text-xs">Present</span>
                            </div>
                            <div className="flex flex-col items-center mx-5">
                                <img src="..\img\Absent.png" alt="Absent" className="h-15 w-15" />
                                <span className="text-2xl font-semibold mt-2">5</span>
                                <span className="text-xs">Absent</span>
                            </div>
                            <div className="flex flex-col items-center">
                                <img src="..\img\Late.png" alt="Late" className="h-15 w-15" />
                                <span className="text-2xl font-semibold mt-2">3</span>
                                <span className="text-xs">Late</span>
                            </div>
                        </div>
                    </Card>
                </div>

                <div className="flex flex-1 min-w-[300px]">
                    <Card
                        title="Pending Request"
                        variant="admin"
                        radius="none"
                        hasButton
                        footer="View All Requests"
                        className="flex-1 bg-yellow-400 shadow-[8px_8px_0_#5E451D]"
                    >
                        <div className="flex flex-col gap-3 mt-1">
                            <div className="flex items-center gap-4">
                                <img src="..\img\Leave Request.png" className="h-7 w-7" />
                                <span className="text-xs">Leave Request</span>
                            </div>
                            <div className="flex items-center gap-4">
                                <img src="..\img\Overtime Requests.png" className="h-7 w-7" />
                                <span className="text-xs">Overtime Requests</span>
                            </div>
                            <div className="flex items-center gap-4">
                                <img src="..\img\Schedule Changes.png" className="h-7 w-7" />
                                <span className="text-xs">Schedule Changes</span>
                            </div>
                        </div>
                    </Card>
                </div>

                <div className="flex flex-1 min-w-[300px]">
                    <Card
                        title="Upcoming Schedules"
                        variant="admin"
                        radius="none"
                        hasButton
                        footer="View all Schedules"
                        className="flex-1 bg-yellow-400 shadow-[8px_8px_0_#5E451D]"
                    >
                        <div className="flex flex-col flex-1 mt-1 gap-3">
                            <div className="flex justify-between items-center border-b border-black">
                                <div className="flex flex-col">
                                    <span className="text-xs">Name</span>
                                    <span className="text-[10px]">Date</span>
                                </div>
                                <span className="px-4 py-1 bg-white text-[10px] rounded-[40px]">
                                    REGULAR
                                </span>
                            </div>
                        </div>
                    </Card>
                </div>
            </div>

            {/* Table section */}
            <div className="mt-7 w-full">
                <Card
                    title="Recent Activities"
                    variant="admin"
                    radius="none"
                    className="w-full bg-yellow-400 shadow-[8px_8px_0_#5E451D]"
                >
                    <Table columns={columns} data={data} className="mt-4" />
                </Card>
            </div>
        </div>

    )
}

export default Dashboard
