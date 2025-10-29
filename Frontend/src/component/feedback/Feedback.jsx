import React, { useEffect } from "react";

export default function Feedback({ message, type = "success", onClose }) {
  useEffect(() => {
    const timer = setTimeout(onClose, 1500);
    return () => clearTimeout(timer);
  }, [onClose]);

  return (  
    <div
      className={`fixed top-6 right-6 px-4 py-2 rounded-md text-sm shadow-md transition-opacity
      ${type === "success" ? "bg-green-600 text-white" : ""}
      ${type === "error" ? "bg-red-600 text-white" : ""}
      `}
    >
      {message}
    </div>
  );
}
