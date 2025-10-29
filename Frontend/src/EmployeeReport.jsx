import React, { useState, useEffect, useRef } from "react";
import { Button } from "./component/ui/button";
import DynamicForm from "./component/form/Form";  
import { io } from "socket.io-client";


import MessageModal from "./component/modals/MessageModal";
import ConfirmModal from "./component/modals/ConfirmModal";
import RequestModal from "./component/modals/RequestModal";

const tabList = ["Leave", "Overtime", "Off-set"];

const leaveFields = [
  { name: "type", label: "Type of Leave", type: "select", options: ["Sick Leave", "Emergency Leave", "Vacation Leave"], required: true },
  { name: "startDate", label: "Start Date", type: "date", required: true },
  { name: "endDate", label: "End Date", type: "date", required: true },
  { name: "days", label: "Days of Leave", type: "number", disabled: true },
  { name: "reason", label: "Reason", type: "textarea", fullWidth: true, required: true },
  { name: "link", label: "Attach Google Drive Link", type: "text", fullWidth: true },
];

export default function EmployeeReport() {
  const employeeId = localStorage.getItem("employeeId");
  const today = new Date().toISOString().split("T")[0];
  
  const tabMap = {
    leave: "leave",
    overtime: "overtime",
    "off-set": "off-set",
  };
  
  const [confirmModal, setConfirmModal] = useState({ isOpen: false, message: "", onConfirm: null });
  const [messageModal, setMessageModal] = useState({ isOpen: false, title: "", message: "" });
  
  const savedTab = localStorage.getItem("employeeTabs")?.toLowerCase() || "leave";
  const [activeTab, setActiveTab] = useState(savedTab);
  const [formValues, setFormValues] = useState({});
  const [recentRequests, setRecentRequests] = useState({});
  const [scheduleDays, setScheduleDays] = useState([]);
  const [formattedDays, setFormattedDays] = useState([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const didFetchRef = useRef(false);
  const socketRef = useRef(null);

  const openRequestModal = (req) => {
    setSelectedRequest(req);
    setIsModalOpen(true);
  };
  
  useEffect(() => {
    socketRef.current = io("http://localhost:3001");

    const handleUpdate = (updatedRequest) => {
      const reqTab = updatedRequest.request_type.toLowerCase();
      setRecentRequests(prev => {
        const prevTabRequests = prev[reqTab] || [];
        const updatedTabRequests = prevTabRequests.map(req =>
          req.request_id === updatedRequest.request_id ? updatedRequest : req
        );

        // If not found, add new
        if (!prevTabRequests.find(r => r.request_id === updatedRequest.request_id)) {
          updatedTabRequests.push(updatedRequest);
        }

        return { ...prev, [reqTab]: updatedTabRequests };
      });
    };

    socketRef.current.on("employeeRequestUpdated", handleUpdate);

    return () => {
      socketRef.current.off("employeeRequestUpdated", handleUpdate);
      socketRef.current.disconnect();
    };
  }, []); // <- empty dependency array




  useEffect(() => {
    if (didFetchRef .current) return;
    didFetchRef.current = true;
    const fetchSchedule = async () => {
      try {
        const res = await fetch(`http://localhost:3001/api/employee/schedule/${employeeId}`);
        if (!res.ok) throw new Error("Failed to fetch schedule");
        const data = await res.json();
        if (data.success) {
          const daysSet = new Set(data.data.map(d => d.work_date));
          const formattedScheduleDays = [...daysSet].map(isoDate => {
            const date = new Date(isoDate);
            return date.toLocaleDateString("en-US", {
              month: "short", // Nov
              day: "2-digit", // 02
              year: "numeric"  // 2025
            });
          });
          setFormattedDays([...formattedScheduleDays])
          setScheduleDays([...daysSet]);
        }
      } catch (err) {
        console.error("Error fetching schedule:", err);
      }
    };
    fetchSchedule();
  }, [employeeId]);

  
  const overtimeFields = [
    { name: "type", label: "Select Type", type: "select", options: ["Early-in", "Overtime"], fullWidth: true, required: true },
    { name: "date", label: "Date", type: "select", options: formattedDays, required: true },
    { name: "hours", label: "Requested Hours", type: "number", required: true },
    { name: "reason", label: "Reason", type: "textarea" },
    { name: "link", label: "Attach Google Drive Link", type: "text", fullWidth: true },
  ];

  
  const offsetFields = [
    { name: "date", label: "Date", type: "select", options: formattedDays, fullWidth: true, required: true },
    { name: "type", label: "Type of Shift", type: "select", options: ["Opening", "Closing"], required: true },
    { name: "hours", label: "Total Hours", type: "number", required: true, min: 1, max:4 },
    { name: "reason", label: "Reason", type: "textarea" },
    { name: "link", label: "Attach Google Drive Link", type: "text", fullWidth: true },
  ];


  const fetchRecentRequests = async (tab, force = false) => {
    const dbType = tabMap[tab] || tab;
    if (!force && recentRequests[tab]) return;

    try {
      const res = await fetch(`http://localhost:3001/api/employee/requests/${employeeId}?type=${dbType}`);
      if (!res.ok) throw new Error("Failed to fetch requests");
      const data = await res.json();
      if (data.success) setRecentRequests(prev => ({ ...prev, [tab]: data.data }));
    } catch (err) {
      console.error("Error fetching requests:", err);
    }
  };

  useEffect(() => {
    fetchRecentRequests(activeTab);
  }, [activeTab]);

  useEffect(() => {
    if (activeTab !== "leave" || !formValues.startDate || !formValues.endDate) {
      setFormValues(prev => ({ ...prev, days: 0 }));
      return;
    }

    const fetchLeaveDays = async () => {
      try {
        const res = await fetch(
          `http://localhost:3001/api/employee/leave/${employeeId}?start=${formValues.startDate}&end=${formValues.endDate}`
        );
        if (!res.ok) throw new Error("Failed to fetch leave days");
        const data = await res.json();
        setFormValues(prev => ({ ...prev, days: data.success ? data.days : 0 }));
      } catch {
        setFormValues(prev => ({ ...prev, days: 0 }));
      }
    };

    fetchLeaveDays();
  }, [formValues.startDate, formValues.endDate, activeTab, employeeId]);

  const handleSubmit = async (data) => {
    if (isSubmitting) return;
    const payload = { ...data, request_type: tabMap[activeTab] };

    if ((activeTab === "overtime" || activeTab === "off-set") && data.date) {
      const existing = recentRequests[activeTab]?.some(
        req => req.date === data.date && (req.status === "pending" || req.status === "approved")
      );
      if (existing) {
        return setMessageModal({
          isOpen: true,
          title: "Error",
          message: `You already submitted a ${activeTab} request for this date.`
        });
      }
    }

    if (activeTab === "leave") {
      payload.start_date = data.startDate;
      payload.end_date = data.endDate;
      if (payload.hours) delete payload.hours;
    } else {
      payload.date = data.date;
    }

    if ((activeTab === "off-set" || activeTab === "overtime") && payload.hours) {
      payload.hours = Number(payload.hours);
    }

    setIsSubmitting(true);

    try {
      const res = await fetch(`http://localhost:3001/api/employee/request/${employeeId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const result = await res.json();

      setMessageModal({
        isOpen: true,
        title: result.success ? "Success" : "Error",
        message: result.success ? "Request submitted!" : result.message
      });

      if (result.success) {
        setFormValues({});
        await fetchRecentRequests(activeTab, true);
      }
    } catch (err) {
      setMessageModal({ isOpen: true, title: "Error", message: "Failed to submit request" });
      console.error("Submit error:", err);
    } finally {
      setIsSubmitting(false);
    }
  };



  // ✅ DATE VALIDATION ADDED HERE
  const getFields = () => {
    const todayDate = new Date();
    const fourDaysAhead = new Date();
    fourDaysAhead.setDate(fourDaysAhead.getDate() + 4);

    const minDateFourDaysAhead = fourDaysAhead.toISOString().split("T")[0];

    // (Optional) Cap to one year max
    const oneYearFromToday = new Date();
    oneYearFromToday.setFullYear(oneYearFromToday.getFullYear() + 1);
    const maxDateOneYear = oneYearFromToday.toISOString().split("T")[0];
        
    let fields = [];
    switch (activeTab) {
      case "leave":
        fields = leaveFields.map(f => f.name === "days" ? { ...f, value: formValues.days || 0 } : f);
        break;
      case "overtime":
        fields = overtimeFields;
        break;
      case "off-set":
        fields = offsetFields;
        break;
      default:
        fields = [];
    }

    return fields.map(f => {
      if (f.type === "date") {

        // ✅ Leave end date rule (KEEP EXACTLY AS IS)
        if (activeTab === "leave" && f.name === "endDate") {
          return { ...f, min: formValues.startDate || today, max: maxDateOneYear };
        }

        // ✅ Off-set return date rule (KEEP, just cap)
        if (activeTab === "off-set" && f.name === "returnDate") {
          return { ...f, min: formValues.date || today, max: maxDateOneYear };
        }

        // ✅ OVERTIME & OFF-SET MAIN DATE MUST BE 4 DAYS AHEAD MINIMUM
        if ((activeTab === "overtime" || activeTab === "off-set") && f.name === "date") {
          return { ...f, min: minDateFourDaysAhead, max: maxDateOneYear };
        }

        // Default for other dates
        return { ...f, min: today, max: maxDateOneYear };
      }
      return f;
    });
  };

  const handleCancel = (requestId) => {
    setConfirmModal({
      isOpen: true,
      message: "Are you sure you want to cancel this request?",
      onConfirm: async () => {
        setConfirmModal(prev => ({ ...prev, isOpen: false }));
        try {
          const res = await fetch(`http://localhost:3001/api/employee/request/${requestId}`, { method: "DELETE" });
          const result = await res.json();
          setMessageModal({
            isOpen: true,
            title: result.success ? "Success" : "Error",
            message: result.success ? "Request cancelled" : result.message
          });
          if (result.success) {
            fetchRecentRequests(activeTab, true);
            setIsModalOpen(false);
          }
        } catch (err) {
          setMessageModal({ isOpen: true, title: "Error", message: "Error cancelling request" });
          console.error(err);
        }
      }
    });
  };


  const handleAction = (requestId, action) => {
    setConfirmModal({
      isOpen: true,
      message: `Are you sure you want to ${action} this request?`,
      onConfirm: async () => {
        setConfirmModal(prev => ({ ...prev, isOpen: false }));
        try {
          await fetch(`http://localhost:3001/api/employee/requests/${requestId}/action`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ action }) // accept / decline
          });

          // Socket will automatically update the request in your list
          setIsModalOpen(false);
        } catch (err) {
          setMessageModal({ isOpen: true, title: "Error", message: "Error performing action" });
          console.error(err);
        }
      }
    });
  };



  return (
    <div className="font-inter">
      <div className="flex justify-between w-full text-lg border-b">
        {tabList.map((tab, index) => {
          const lowerTab = tab.toLowerCase();
          return (
            <Button
              key={index}
              onClick={() => {
                setActiveTab(lowerTab);
                localStorage.setItem("employeeTabs", lowerTab);
              }}
              className={`border-b-2 pb-2 w-full ${activeTab === lowerTab ? "border-current" : "border-transparent"}`}
            >
              {tab}
            </Button>
          );
        })}
      </div>

      <div className="mt-4 space-y-3">
        <h1 className="font-semibold text-xl">
          {activeTab === "leave" && "Leave Request"}
          {activeTab === "overtime" && "Overtime Request"}
          {activeTab === "off-set" && "Off-set Request"}
        </h1>
        {activeTab === "leave" && <p className="text-md mb-5">Submit a request for time off</p>}

        <DynamicForm
          fields={getFields()}
          formValues={formValues}
          onFieldChange={(name, value) => setFormValues(prev => ({ ...prev, [name]: value }))}
          onSubmit={handleSubmit}
          isSubmitting={isSubmitting}
        />

        <div className="mt-10 mb-7">
          <h1 className="font-semibold text-lg">Recent Requests</h1>
          {(!recentRequests[activeTab] || recentRequests[activeTab].length === 0) && <p>No recent requests</p>}
            {recentRequests[activeTab]?.filter(req => req.request_type === tabMap[activeTab]).map(req => {
              let startDate, endDate;

              if (activeTab === "leave") {
                startDate = new Date(req.start_date);
                endDate = new Date(req.end_date || req.start_date);
              } else {
                // Overtime & Off-set use `date`
                startDate = new Date(req.date);
                endDate = startDate;
              }

              const options = { month: "short", day: "numeric" };

              const displayDate =
                activeTab === "leave"
                  ? (startDate.getTime() === endDate.getTime()
                      ? startDate.toLocaleDateString("en-US", options)
                      : `${startDate.toLocaleDateString("en-US", options)} - ${endDate.toLocaleDateString("en-US", options)}`)
                  : startDate.toLocaleDateString("en-US", options);


              const statusColors = {
                approved: "bg-green-100 text-green-800",
                pending: "bg-yellow-100 text-yellow-800",
                rejected: "bg-red-100 text-red-800",
                partial: "bg-blue-100 text-blue-800",
              };

              const statusLabel = (req.status === "partial" && req.admin_comment)
                ? req.admin_comment
                : req.status?.charAt(0).toUpperCase() + req.status?.slice(1) || "Unknown";

              return (
                <div
                  key={req.request_id}
                  onClick={() => openRequestModal(req)}
                  className="border px-5 py-4 rounded-lg mb-2 shadow-sm flex justify-between items-start cursor-pointer hover:bg-gray-50"
                >
                  <div>
                    <p className="text-xl font-semibold">
                      {req.type}{req.hours ? ` (${req.hours} hours)` : ""}
                    </p>
                    <p className="text-gray-700">{displayDate}</p>
                  </div>
                  <span className={`px-3 py-1 rounded-full font-medium ${statusColors[req.status] || "bg-gray-100 text-gray-800"}`}>
                    {statusLabel}
                  </span>
                </div>
              );
          })}
        </div>
      </div>
      <RequestModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        request={selectedRequest}
        onCancel={handleCancel}
        onAction={handleAction}
      />
      <ConfirmModal
        isOpen={confirmModal.isOpen}
        message={confirmModal.message}
        onCancel={() => setConfirmModal(prev => ({ ...prev, isOpen: false }))}
        onConfirm={confirmModal.onConfirm}
      />

      <MessageModal
        isOpen={messageModal.isOpen}
        title={messageModal.title}
        message={messageModal.message}
        onClose={() => setMessageModal(prev => ({ ...prev, isOpen: false }))}
      />

    </div>
  );
}
