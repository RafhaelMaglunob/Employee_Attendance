import React from "react";
import { Button } from "../ui/button";

export default function RequestModal({ isOpen, onClose, request, onCancel, onAction }) {
  if (!isOpen || !request) return null;

  const statusColors = {
    approved: "bg-green-100 text-green-800",
    pending: "bg-yellow-100 text-yellow-800",
    declined: "bg-red-100 text-red-800",
    partial: "bg-blue-100 text-blue-800",
  };

  const formatDateForInput = (dateStr) => {
    if (!dateStr) return "";
    const d = new Date(dateStr);
    return d.toLocaleDateString("en-US", {
      month: "long", // Oct
      day: "2-digit", // 29
      year: "numeric" // 2025
    });
  };

  const displayDate = (() => {
    const startDate = new Date(request.start_date);
    const endDate = new Date(request.end_date || request.start_date);
    const options = { month: "short", day: "numeric" };
    if (request.request_type === "leave") {
      return startDate.getTime() === endDate.getTime()
        ? startDate.toLocaleDateString("en-US", options)
        : `${startDate.toLocaleDateString("en-US", options)} - ${endDate.toLocaleDateString("en-US", options)}`;
    }
    return startDate.toLocaleDateString("en-US", options);
  })();

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl w-[90%] max-w-[500px] p-6 shadow-xl relative">
        <h2 className="text-2xl font-semibold mb-2">{request.type}</h2>
        <p className="text-gray-700 mb-4">{formatDateForInput(request.date)}</p>
        <div className="mb-4">
          {request.days !== 0 && <p><span className="font-semibold">Days affected:</span> {request.days || "N/A"}</p>}
          {request.hours !== 0 && <p><span className="font-semibold">Hours:</span> {request.hours || "N/A"}</p>}
          <p><span className="font-semibold">Reason:</span> {request.reason || "N/A"}</p>
          {request.link && (
            <p>
              <span className="font-semibold">Link:</span>{" "}
              <a href={request.link} target="_blank" className="text-blue-600 underline">
                {request.link}
              </a>
            </p>
          )}
        </div>

        <span className={`px-3 py-1 rounded-full font-medium ${statusColors[request.status] || "bg-gray-100 text-gray-800"}`}>
          {request.status?.charAt(0).toUpperCase() + request.status?.slice(1) || "Unknown"}
        </span>

        {/* Action Buttons */}
        <div className="mt-6 flex justify-end gap-3">
          {/* Cancel button only if pending */}
          {request.status === "pending" && (
            <Button
              onClick={() => onCancel(request.request_id)}
              className="bg-red-500 px-2 py-1 rounded-xl hover:bg-red-600 text-white"
            >
              Cancel
            </Button>
          )}

          {/* Accept / Decline only if partial */}
          {request.status === "partial" && (
            <>
              <Button
                onClick={() => onAction(request.request_id, "approved")}
                className="bg-green-500 px-2 py-1 rounded-xl hover:bg-green-600 text-white"
              >
                Accept
              </Button>
              <Button
                onClick={() => onAction(request.request_id, "declined")}
                className="bg-red-500 px-2 py-1 rounded-xl hover:bg-red-600 text-white"
              >
                Decline
              </Button>
            </>
          )}

          {/* Close always */}
          <Button onClick={onClose} className="bg-gray-300 px-2 py-1 rounded-xl hover:bg-gray-400">
            Close
          </Button>
        </div>
      </div>
    </div>
  );
}
