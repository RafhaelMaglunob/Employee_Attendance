import React, { useMemo } from 'react'
import { Button } from './component/ui/button'
import { Card } from './component/ui/card'
import { PaginatedTable } from './component/data/table'
import { useFetchData } from './component/hooks/useFetchData'
import { exportTableToPdf } from './component/utils/exportablePdf'

function Reports() {
    const itemsPerPage = 5

    // Fetch attendance
    const { data: attendanceData, loading: attendanceLoading } = useFetchData(
        'http://192.168.1.9:3001/api/attendance',
        emp => ({
            employee_name: emp.employee_name,
            clock_in: emp.clock_in,
            clock_out: emp.clock_out,
            total_hours: emp.total_hours,
            status: emp.status
        })
    )

    // Fetch incidents
    const { data: incidentData, loading: incidentLoading } = useFetchData(
        'http://192.168.1.9:3001/api/incidents',
        emp => ({
            incident_id: emp.incident_id,
            employee_name: emp.employee_name,
            incident_type: emp.incident_type,
            incident_date: emp.incident_date,
            status: emp.status
        })
    )

    const attendanceColumns = [
        { key: 'employee_name', title: 'Employee Name' },
        { key: 'clock_in', title: 'Clock In' },
        { key: 'clock_out', title: 'Clock Out' },
        { key: 'total_hours', title: 'Total Hours' },
        { 
            key: 'status',
            title: 'Status',
            render: row => (
            <span
                className={`px-4 py-1 rounded-[40px] text-[10px] border ${
                row.status?.toLowerCase() === 'absent'
                    ? 'bg-[#FEE2E2] border-[#991B1B]'
                    : row.status?.toLowerCase() === 'present'
                    ? 'bg-[#DCFCE7] border-[#166534]'
                    : 'bg-[#FEF9C3] border-[#854D0E]'
                }`}
            >
                {row.status}
            </span>
            ),   
        }
    ]

    const incidentColumns = [
        { key: 'incident_id', title: 'Incident ID' },
        { key: 'employee_name', title: 'Employee Name' },
        { key: 'incident_type', title: 'Type' },
        { key: 'incident_date', title: 'Date' },
        { key: "status", title: "Status" }
    ]

    const filteredIncidentData = useMemo(() => {
        if (!incidentData) return []
        return incidentData
    }, [incidentData])

    return (
        <div className="pb-5">
        {/* Header */}
            <div className="flex justify-between items-center mb-5 mt-3 mr-3">
                <h1 className="font-bold text-2xl">Reports</h1>
                <div className="flex space-x-3">
                    <Button className="bg-white px-4 py-2 rounded-xl border hover:bg-black/10 flex items-center">
                        <img
                            src="../img/Print_Icon.png"
                            alt="Print"
                            className="w-5 h-5 mr-2"
                        />
                        Print
                    </Button>
                    <Button
                        onClick={() =>
                            exportTableToPdf(
                                incidentColumns,
                                filteredIncidentData,
                                `reports_${new Date().toISOString()}.docx`
                            )
                        }
                        className="bg-black text-white px-3 py-2 rounded-xl flex items-center hover:bg-black/70"
                    >
                        <img
                            src="../img/Export_Icon.png"
                            alt="Export"
                            className="w-5 h-5 mr-2 invert"
                        />
                        Export Report
                    </Button>
                </div>
            </div>

            <div className="flex flex-col space-y-5">
                {/* Attendance Section */}
                <div className="w-[47%]">
                    <Card variant="admin" radius="none" className="font-bold">
                        <div className="flex flex-row items-center space-x-4">
                            <img
                                src="../../img/Clock_Icon.png"
                                alt="Clock Icon"
                                className="w-10 h-10"
                            />
                            <h1>Daily Attendance</h1>
                        </div>
                    </Card>
                </div>

                <Card title="Daily Attendance Report" variant="admin" radius="none">
                    {attendanceLoading ? (
                        <p>Loading attendance data...</p>
                    ) : (
                        <PaginatedTable
                        columns={attendanceColumns}
                        data={attendanceData}
                        itemsPerPage={itemsPerPage}
                        />
                    )}
                </Card>

                {/* Incident Section */}
                <div className="w-[47%]">
                    <Card variant="admin" radius="none" className="font-bold">
                        <div className="flex flex-row items-center space-x-4">
                            <img
                                src="../../img/Incident_Alert_Icon.png"
                                alt="Incident Icon"
                                className="w-10 h-10"
                            />
                            <h1>Incident Report</h1>
                        </div>
                    </Card>
                </div>

                <Card title="Incident Summary Report" variant="admin" radius="none">
                    {incidentLoading ? (
                        <p>Loading incident data...</p>
                    ) : (
                        <PaginatedTable
                            columns={incidentColumns}
                            data={filteredIncidentData}
                            itemsPerPage={itemsPerPage}
                        />
                    )}
                </Card>
            </div>
        </div>
    )
}

export default Reports
