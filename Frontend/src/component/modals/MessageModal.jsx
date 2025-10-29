import React from "react";

export default function MessageModal({ isOpen, onClose, message, title }) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white rounded-lg shadow-lg max-w-sm w-full p-6">
        {title && <h2 className="text-lg font-semibold mb-3">{title}</h2>}
        <p className="text-gray-800 mb-6">{message}</p>
        <div className="flex justify-end">
          <button
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
            onClick={onClose}
          >
            OK
          </button>
        </div>
      </div>
    </div>
  );
}
