import React, { useMemo, useState } from "react";
import { Button } from "./component/ui/button";
import { Card } from "./component/ui/card";
import { PaginatedTable } from "./component/data/table";
import { useFetchData } from "./component/hooks/useFetchData";
import { exportTableToPdf } from "./component/utils/exportablePdf";

import RequestViewModal from "./component/modals/RequestViewModal";

function Approval() {
  const itemsPerPage = 5;
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);

  const handleReview = request => {
    setSelectedRequest(request);
    setModalOpen(true);
  };

  // Fetch Employee Requests
  const { data: requestData, loading: requestLoading } = useFetchData(
    "http://localhost:3001/api/employees/requests",
    req => ({
      employee_id: req.employee_id,
      request_id: req.request_id,
      employee_name: req.employee_name,
      type: req.type,
      days: req.days,
      start_date: req.start_date,
      end_date: req.end_date,
      hours: req.hours,
      date: req.date,
      status: req.status,
      request_type: req.request_type,
      current_date: req.current_date,
      current_time: req.current_time,
      requested_date: req.requested_date,
      requested_time: req.requested_time,
    })
  );

  // Separate data per request type
  const leaveData = useMemo(() => requestData?.filter(r => r.request_type === "leave") || [], [requestData]);
  const overtimeData = useMemo(() => requestData?.filter(r => r.request_type === "overtime") || [], [requestData]);
  const offsetData = useMemo(() => requestData?.filter(r => r.request_type === "off-set") || [], [requestData]);

  const statusBadge = status => {
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
    {
      key: "employee_name",
      title: "Employee",
      render: row => (
        <div className="flex flex-col">
          <span className="text-sm">{row.employee_name}</span>
        </div>
      )
    },
    { key: "type", title: "Type" },
    {
      key: "duration",
      title: "Duration",
      render: row => {
        const start = row.start_date || "-";
        const end = row.end_date || "-";
        const days = row.days || 1;
        return (
          <>
            <div>{start} - {end}</div>
            <div className="text-sm text-gray-500">{days} day(s)</div>
          </>
        );
      }
    },
    {
      key: "status",
      title: "Status",
      render: row => <span className={`px-3 py-1 rounded-full ${statusBadge(row.status)}`}>{row.status.charAt(0).toUpperCase() + row.status.slice(1)}</span>
    },
    {
      key: "action",
      title: "Action",
      render: row => <Button size="sm" onClick={() => handleReview(row)}>Review</Button>
    }
  ];

  const overtimeColumns = [
    {
      key: "employee_name",
      title: "Employee",
      render: row => (
        <div className="flex flex-col">
          <span>{row.employee_name}</span>
        </div>
      )
    },
    { key: "date", title: "Date", render: row => row.date || "-" },
    { key: "hours", title: "Hours", render: row => `${row.hours || 0} hours` },
    {
      key: "status",
      title: "Status",
      render: row => <span className={`px-3 py-1 rounded-full ${statusBadge(row.status)}`}>{row.status.charAt(0).toUpperCase() + row.status.slice(1)}</span>
    },
    { 
      key: "action",
      title: "Action", 
      render: row => <Button size="sm" onClick={() => handleReview(row)}>Review</Button> 
    }
  ];

  const offsetColumns = [
    {
      key: "employee",
      title: "Employee",
      render: row => (
        <div className="flex items-center gap-3">
          <div className="font-medium">{row.employee_name}</div>
        </div>
      )
    },
    {
      key: "type",
      title: "Shift Type",
      render: row => row.type || "-"
    },
    {
      key: "date",
      title: "Requested Schedule",
      render: row => (
        <div>
          <div>{row.date || "-"}</div>
          <div className="text-xs text-gray-500">{row.hours ? `${row.hours} hour(s)` : "-"}</div>
        </div>
      )
    },
    {
      key: "status",
      title: "Status",
      render: row => <span className={`px-3 py-1 rounded-full ${statusBadge(row.status)}`}>{row.status?.charAt(0).toUpperCase() + row.status?.slice(1)}</span>
    },
    { 
      key: "action", 
      title: "Action", 
      render: row => <Button size="sm" onClick={() => handleReview(row)}>Review</Button>
    }
  ];


  return (
    <div className="pb-5">
      <div className="flex justify-between items-center mb-5 mt-3 mr-3">
        <h1 className="font-bold text-2xl">Employee Requests</h1>
        <Button
          onClick={() => exportTableToPdf([...leaveColumns, ...overtimeColumns, ...offsetColumns], requestData || [], `employee_requests_${new Date().toISOString()}.docx`)}
          className="bg-black text-white px-3 py-2 rounded-xl flex items-center hover:bg-black/70"
        >
          Export Report
        </Button>
      </div>

      <div className="flex flex-col space-y-5">
        <Card title="Leave Requests" variant="admin" radius="none">
          {requestLoading ? <p>Loading leave requests...</p> : <PaginatedTable columns={leaveColumns} data={leaveData} itemsPerPage={itemsPerPage} />}
        </Card>

        <Card title="Overtime Requests" variant="admin" radius="none">
          {requestLoading ? <p>Loading overtime requests...</p> : <PaginatedTable columns={overtimeColumns} data={overtimeData} itemsPerPage={itemsPerPage} />}
        </Card>

        <Card title="Off-set Requests" variant="admin" radius="none">
          {requestLoading ? <p>Loading off-set requests...</p> : <PaginatedTable columns={offsetColumns} data={offsetData} itemsPerPage={itemsPerPage} />}
        </Card>
      </div>
      <RequestViewModal
        isOpen={modalOpen}
        request={selectedRequest}
        onClose={() => setModalOpen(false)}
        onApprove={(req) => handleAction(req, "approve")}
        onPartial={(req, partialData) => handleAction(req, "partial", partialData)}
        onDecline={(req, remarks) => handleAction(req, "decline", remarks)}
      />

    </div>
  );
}

export default Approval;
