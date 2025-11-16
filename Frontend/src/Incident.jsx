import React, { useState, useMemo } from 'react'
import { Card } from './component/ui/card'
import { Table } from './component/data/table'
import { Button } from './component/ui/button'
import { useFetchData } from './component/hooks/useFetchData'

const formatDate = (dateStr) => {
    if (!dateStr) return "-";
    const date = new Date(dateStr);
    return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
};

function Incident() {
    const savedTab = localStorage.getItem("incidentTab");

    const [activeTab, setActiveTab] = useState(savedTab || "All Incidents");
    const [status, setStatus] = useState("");
    const [selectedIncident, setSelectedIncident] = useState();

    const { data, loading } = useFetchData(
        `http://192.168.1.9:3001/api/incidents`,
        emp => ({
            incident_id: emp.incident_id,
            employee_id: emp.employee_id,
            name: emp.employee_name,
            incident_type: emp.incident_type,
            incident_date: emp.incident_date,
            status: emp.status,
            witness: emp.witness,
            reported_by: emp.reported_by,
            description: emp.description
        })
    )

    const tabList = [
        { key: "all", title: "All Incidents" },
        { key: "pending", title: "Pending" },
        { key: "resolved", title: "Resolved" }
    ];

    const tableColumns = [
        { key: "incident_id", title: "ID" },
        { key: "name", title: "Employee" },
        { key: "incident_type", title: "Type" },
        { 
            key: "incident_date", 
            title: "Date",
            render: row => formatDate(row.incident_date) 
        },
        { 
            key: "status", 
            title: "Status", 
            render: row => (
                <span className={`px-4 py-1 rounded-[40px] text-[10px] border ${
                    row.status === "Pending" ? "bg-[#FEF9C3] border-[#854D0E]" :
                    row.status === "Resolved" ? "bg-[#DCFCE7] border-[#166534]" :
                    "bg-gray-200 border-gray-400"
                }`}>
                    {row.status}
                </span>
            )
        },
        { 
            key: "action", 
            title: "Action", 
            render: (row) => (
                <Button onClick={() => handleView(row)} className="rounded-[50px] hover:bg-black/20 w-10 h-10 ">
                    View
                </Button> 
            )
        }
    ];


    // Placeholder for handleView
    const handleView = (row) => {
        setSelectedIncident(row);
    };

    const handleResolve = async (incidentId) => {
        if (!window.confirm("Mark this incident as resolved?")) return;

        try {
            const res = await fetch(`http://192.168.1.9:3001/api/incidents/${incidentId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ status: "Resolved" })
            });

            const data = await res.json();
            if (data.success) {
                alert("Incident marked as resolved!");
                // Refresh incidents list
                setSelectedIncident(data.data); // update the details view
            } else {
                alert(data.message || "Failed to update status");
            }
        } catch (err) {
            console.error("Error updating incident:", err);
            alert("Error updating incident status");
        }
    };

    const filteredData = useMemo(() => {
        if (!data) return [];
        if (activeTab === "All Incidents") return data;
        return data.filter(item => item.status.toLowerCase() === activeTab.toLowerCase());
    }, [data, activeTab]);

    if (loading) return <p className="text-gray-400 text-xl">Loading...</p>

    return (
        <div className="pb-5">
            <h1 className="font-bold text-2xl mb-3">Incident Reports</h1>
            <div className="flex flex-col sm:flex-row justify-between w-full space-x-10 space-y-5">
                <Card 
                    className="sm:flex-[2.5] self-auto h-[90%]" 
                    title="Incidents"
                    titleSize="lg"
                    variant="admin" 
                    radius='none'
                >
                    <div>
                        <div className="flex flex-row space-x-6 w-full border-b mb-5">
                            {tabList.map((tab, index) => (
                                <Button
                                    key={index}
                                    className={`text-sm border-b-2 ${activeTab.toLowerCase() === tab.title.toLowerCase() ? "border-current" : "border-transparent"}`}
                                    onClick={() => {
                                        setActiveTab(tab.title);
                                        setStatus(tab.title === "All Incidents" ? "" : tab.title);
                                    }}
                                >
                                    {tab.title}
                                </Button>
                            ))}
                        </div>

                        <Table columns={tableColumns} data={filteredData}></Table>
                    </div>
                </Card>

                <div className="flex-[2]">
                    <Card 
                        className="" 
                        title={"Incident Details"} 
                        titleSize={"lg"} 
                        variant="admin" 
                        radius='none'
                    >
                        <div className="flex flex-1 flex-col space-y-3">
                            <div className="flex gap-4">
                                <div className="flex-1 flex flex-col">
                                    <label className="text-xs">Incident ID</label>
                                    <span className="px-4 py-2 rounded-lg bg-white border-2 font-semibold">
                                        {selectedIncident?.incident_id || "-"}
                                    </span>
                                </div>
                                <div className="flex-1 flex flex-col">
                                    <label className="text-xs">Date</label>
                                    <span className="px-4 py-2 rounded-lg bg-white border-2 font-semibold">
                                        {formatDate(selectedIncident?.incident_date) || "-"}
                                    </span>
                                </div>
                            </div>
                            <label className="text-xs">Employee</label>
                            <span className="px-4 py-2 rounded-lg bg-white border-2 font-semibold">
                                {selectedIncident?.name || "-"}
                            </span>
                            <div className="flex gap-4">
                                <div className="flex-1 flex flex-col">
                                    <label className="text-xs">Reported By</label>
                                    <span className="px-4 py-2 rounded-lg bg-white border-2 font-semibold">
                                        {selectedIncident?.reported_by || "-"}
                                    </span>
                                </div>
                                <div className="flex-1 flex flex-col">
                                    <label className="text-xs">Incident Type</label>
                                    <span className="px-4 py-2 rounded-lg bg-white border-2 font-semibold">
                                        {selectedIncident?.incident_type || "-"}
                                    </span>
                                </div>
                            </div>
                            <label className="text-xs">Status</label>
                            <span className={`px-4 py-1 rounded-[40px] text-[10px] border w-fit ${
                                selectedIncident?.status === "Pending" ? "bg-[#FEF9C3] border-[#854D0E]" :
                                selectedIncident?.status === "Resolved" ? "bg-[#DCFCE7] border-[#166534]" :
                                "bg-gray-200 border-gray-400"
                            }`}>
                                {selectedIncident?.status || "-"}
                            </span>
                            <label className="text-xs">Description</label>
                            <span className="px-4 py-2 rounded-lg bg-white border-2 font-semibold">
                                {selectedIncident?.description || "-"}
                            </span>
                            <label className="text-xs">Witnesses</label>
                            <span className="px-4 py-2 rounded-lg bg-white border-2 font-semibold">
                                {selectedIncident?.witness || "-"}
                            </span>

                            <div className="flex gap-4 justify-end mt-3">
                                <Button 
                                    onClick={() => setSelectedIncident(null)}
                                    className="px-3 py-2 bg-white border rounded-lg"
                                >
                                    Clear
                                </Button>

                                {selectedIncident?.status !== "Resolved" && (
                                    <Button
                                        onClick={() => handleResolve(selectedIncident.incident_id)}
                                        className="px-3 py-2 bg-green-500 text-white rounded-lg"
                                    >
                                        Mark as Resolved
                                    </Button>
                                )}
                            </div>
                        </div>
                    </Card>
                </div>
                
            </div>
        </div>
    )
}

export default Incident
