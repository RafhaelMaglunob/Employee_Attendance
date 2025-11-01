import React, { useMemo, useState, useEffect, useCallback } from "react";
import { Button } from "./component/ui/button";
import { Card } from "./component/ui/card";
import { PaginatedTable } from "./component/data/table";
import { exportTableToPdf } from "./component/utils/exportablePdf";
import RequestViewModal from "./component/modals/RequestViewModal";
import { useSocket } from "./component/utils/SocketContext"; // your socket context

function Approval() {
  const itemsPerPage = 5;
  const { socket, isConnected } = useSocket(); // get socket
  const [requestData, setRequestData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);

  const fetchRequests = useCallback(async () => {
    try {
      const res = await fetch("http://localhost:3001/api/employees/requests");
      if (!res.ok) throw new Error("Failed to fetch requests");
      const data = await res.json();
      setRequestData(data.data || []);
    } catch (err) {
      console.error("Fetch error:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRequests(); // fetch once on mount
  }, [fetchRequests]);

  // Real-time updates via socket
  useEffect(() => {
    if (!socket) return;

    const handleUpdate = (updatedReq) => {
      setRequestData((prev) => {
        const index = prev.findIndex(r => r.request_id === updatedReq.request_id);
        if (index !== -1) {
          const newData = [...prev];
          newData[index] = { ...newData[index], ...updatedReq };
          return newData;
        } else {
          // optional: add new request if not exists
          return [updatedReq, ...prev];
        }
      });
    };

    socket.on("leaveRequestUpdated", handleUpdate);
    socket.on("overtimeRequestUpdated", handleUpdate);
    socket.on("offsetRequestUpdated", handleUpdate);

    return () => {
      socket.off("leaveRequestUpdated", handleUpdate);
      socket.off("overtimeRequestUpdated", handleUpdate);
      socket.off("offsetRequestUpdated", handleUpdate);
    };
  }, [socket]);

  const handleReview = (request) => {
    setSelectedRequest(request);
    setModalOpen(true);
  };

  // Separate data per request type
  const leaveData = useMemo(() => requestData.filter(r => r.request_type === "leave"), [requestData]);
  const overtimeData = useMemo(() => requestData.filter(r => r.request_type === "overtime"), [requestData]);
  const offsetData = useMemo(() => requestData.filter(r => r.request_type === "off-set"), [requestData]);

  const statusBadge = (status) => {
    const colors = {
      approved: "bg-green-100 text-green-800",
      pending: "bg-yellow-100 text-yellow-800",
      rejected: "bg-red-100 text-red-800",
      partial: "bg-blue-100 text-blue-800",
    };
    return colors[status?.toLowerCase()] || "bg-gray-100 text-gray-800";
  };

  // Columns
  const leaveColumns = [
    { key: "employee_name", title: "Employee", render: row => <div>{row.employee_name}</div> },
    { key: "type", title: "Type" },
    {
      key: "duration",
      title: "Duration",
      render: row => <div><p>{row.start_date} - {row.end_date}</p> <p>({row.days || 0} day(s))</p></div>
    },
    { key: "status", title: "Status", render: row => <span className={`px-3 py-1 rounded-full ${statusBadge(row.status)}`}>{row.status.charAt(0).toUpperCase() + row.status.slice(1)}</span> },
    { key: "action", title: "Action", render: row => <Button size="sm" onClick={() => handleReview(row)}>Review</Button> }
  ];

  const overtimeColumns = [
    { key: "employee_name", title: "Employee", render: row => <div>{row.employee_name}</div> },
    { key: "date", title: "Date", render: row => row.date || "-" },
    { key: "hours", title: "Hours", render: row => `${row.hours || 0} hours` },
    { key: "status", title: "Status", render: row => <span className={`px-3 py-1 rounded-full ${statusBadge(row.status)}`}>{row.status.charAt(0).toUpperCase() + row.status.slice(1)}</span> },
    { key: "action", title: "Action", render: row => <Button size="sm" onClick={() => handleReview(row)}>Review</Button> }
  ];

  const offsetColumns = [
    { key: "employee_name", title: "Employee", render: row => <div>{row.employee_name}</div> },
    { key: "type", title: "Shift Type", render: row => row.type || "-" },
    { key: "date", title: "Requested Schedule", render: row => <div>{row.date} ({row.hours || 0} hour(s))</div> },
    { key: "status", title: "Status", render: row => <span className={`px-3 py-1 rounded-full ${statusBadge(row.status)}`}>{row.status.charAt(0).toUpperCase() + row.status.slice(1)}</span> },
    { key: "action", title: "Action", render: row => <Button size="sm" onClick={() => handleReview(row)}>Review</Button> }
  ];

  return (
    <div className="pb-5">
      <div className="flex justify-between items-center mb-5 mt-3 mr-3">
        <h1 className="font-bold text-2xl">Employee Requests</h1>
        <Button
          onClick={() => exportTableToPdf([...leaveColumns, ...overtimeColumns, ...offsetColumns], requestData, `employee_requests_${new Date().toISOString()}.docx`)}
          className="bg-black text-white px-3 py-2 rounded-xl flex items-center hover:bg-black/70"
        >
          Export Report
        </Button>
      </div>

      <div className="flex flex-col space-y-5">
        <Card title="Leave Requests" variant="admin" radius="none">
          {loading ? <p>Loading leave requests...</p> : <PaginatedTable columns={leaveColumns} data={leaveData} itemsPerPage={itemsPerPage} />}
        </Card>

        <Card title="Overtime Requests" variant="admin" radius="none">
          {loading ? <p>Loading overtime requests...</p> : <PaginatedTable columns={overtimeColumns} data={overtimeData} itemsPerPage={itemsPerPage} />}
        </Card>

        <Card title="Off-set Requests" variant="admin" radius="none">
          {loading ? <p>Loading off-set requests...</p> : <PaginatedTable columns={offsetColumns} data={offsetData} itemsPerPage={itemsPerPage} />}
        </Card>
      </div>

      <RequestViewModal
        isOpen={modalOpen}
        request={selectedRequest}
        onClose={() => setModalOpen(false)}
      />

    </div>
  );
}

export default Approval;
