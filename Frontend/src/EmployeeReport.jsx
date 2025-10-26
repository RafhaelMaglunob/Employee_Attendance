import React, { useState } from "react";
import { Button } from "./component/ui/button";
import DynamicForm from "./component/form/Form";

const tabList = ["Leave", "Overtime", "Off-set"];

const leaveFields = [
    { name: "type", label: "Type of Leave", type: "buttonGroup", options: ["OS"] },
    { name: "days", label: "Days of Leave", type: "number" },
    { name: "startDate", label: "Start Date", type: "date" },
    { name: "endDate", label: "End Date", type: "date" },
    { name: "reason", label: "Reason", type: "textarea", fullWidth: true },
    { name: "link", label: "Attach Link", type: "text", fullWidth: true },
];


const overtimeFields = [
  { name: "type", label: "Select Type", type: "select", options: ["Early-in", "Overtime"] },
  { name: "date", label: "Date", type: "date" },
  { name: "hours", label: "Requested Hours", type: "number" },
  { name: "reason", label: "Reason", type: "textarea" },
  { name: "link", label: "Attach Link", type: "text", fullWidth: true },
];

const offsetFields = [
  { name: "startDate", label: "Start Date", type: "date", fullWidth: true },
  { name: "shift", label: "Type of Shift", type: "select", options: ["Early-in", "Overtime"] },
  { name: "hour", label: "Total Hours", type: "input" },
  { name: "returnDate", label: "Date of Return", type: "date", fullWidth: true },
  { name: "reason", label: "Reason", type: "textarea" },
  { name: "link", label: "Attach Link", type: "text", fullWidth: true },
];

function EmployeeReport() {
  const savedTab = (localStorage.getItem("employeeTabs") || "leave").toLowerCase();
  const [activeTab, setActiveTab] = useState(savedTab);
  const [formValues, setFormValues] = useState({});

  const handleSubmit = (data) => {
    console.log("Submitted:", data);
    setFormValues({});
  };

  const getFields = () => {
    switch (activeTab) {
      case "leave":
        return leaveFields;
      case "overtime":
        return overtimeFields;
      case "off-set":
        return offsetFields;
      default:
        return [];
    }
  };

  return (
    <div className="font-inter">
      {/* Tabs */}
      <div className="flex justify-between w-full text-lg border-b">
        {tabList.map((tab, index) => (
          <Button
            key={index}
            onClick={() => {
              const lowerTab = tab.toLowerCase();
              setActiveTab(lowerTab);
              localStorage.setItem("employeeTabs", lowerTab);
            }}
            className={`border-b-2 pb-2 w-full ${
              activeTab === tab.toLowerCase() ? "border-current" : "border-transparent"
            }`}
          >
            {tab}
          </Button>
        ))}
      </div>

      {/* Form Section */}
      <div className="mt-4 space-y-3">
        <h1 className="font-semibold text-xl">
          {activeTab === "leave" && "Leave Request"}
          {activeTab === "overtime" && "Overtime Request"}
          {activeTab === "off-set" && "Off-set"}
        </h1>
        {activeTab === "leave" && <p className="text-md mb-5">Submit a request for time off</p>}

        <DynamicForm
          fields={getFields()}
          formValues={formValues}
          onFieldChange={(name, value) => setFormValues({ ...formValues, [name]: value })}
          onSubmit={handleSubmit}
        />

        {/* Recent Requests */}
        <div className="mt-10 mb-7">
          <h1 className="font-semibold text-lg">Recent Requests</h1>
        </div>
      </div>
    </div>
  );
}

export default EmployeeReport;
