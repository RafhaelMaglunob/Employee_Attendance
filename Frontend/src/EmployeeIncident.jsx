import React from "react";
import { useNavigate } from "react-router-dom";

function EmployeeIncident() {
  const navigate = useNavigate();

  const incidents = [
    {
      title: "Workplace Issue",
      code: "INC-001",
      date: "Jun 15",
      status: "Pending",
      statusColor: "bg-[#FFE8A3] text-black"
    },
    {
      title: "Suggestion",
      code: "INC-002",
      date: "Jun 10",
      status: "Reviewed",
      statusColor: "bg-[#FFE8A3] text-black"
    },
    {
      title: "Complaint",
      code: "INC-003",
      date: "May 28",
      status: "Resolved",
      statusColor: "bg-[#D1F5CF] text-black"
    }
  ];

  return (
    <div className="font-inter flex flex-col text-black">

      {/* Back + Title */}
      <div className="flex items-center gap-2 py-2 px-1 cursor-pointer text-sm">
        <span onClick={() => navigate(-1)} className="text-xl">&#60;</span>
        <p className="font-medium">Incident Reports</p>
      </div>

      {/* New Report Button */}
      <button className="bg-black text-white rounded-md py-3 mx-3 mt-2 mb-4 flex justify-center items-center gap-2">
        <span className="material-icons text-sm">add</span>
        New Incident Report
      </button>

      {/* Incident List */}
      <div className="flex flex-col gap-3 px-3">
        {incidents.map((item, index) => (
          <div
            key={index}
            className="bg-[#FFC629] shadow-[10px_10px_0_#111827] px-4 py-4 rounded-md flex flex-col gap-1 cursor-pointer"
          >
            <div className="flex justify-between items-center">
              <p className="font-semibold">{item.title}</p>
              <span
                className={`text-xs px-2 py-1 rounded-full font-medium ${item.statusColor}`}
              >
                {item.status}
              </span>
            </div>

            <div className="flex justify-between text-sm text-black/80">
              <p>{item.code}</p>
              <p>{item.date}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Dotted background bottom fade */}
      <div className="mt-6 h-[200px] bg-[url('../img/YellowDots.png')] bg-cover opacity-70"></div>
    </div>
  );
}

export default EmployeeIncident;
