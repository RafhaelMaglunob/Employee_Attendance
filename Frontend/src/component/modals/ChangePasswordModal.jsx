import React, { useState, useEffect } from "react";
import { Button } from "../ui/button"; // adjust path if needed

export default function ChangePasswordModal({ isOpen, onClose, onSubmit }) {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");

  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  if (!isOpen) return null;

  // ✅ Live Validation
  useEffect(() => {
    if (!newPassword && !confirmPassword) {
      setError("");
      return;
    }

    const passwordRegex = /^(?=.*[A-Z])(?=.*\d)(?=.*[\W_]).{8,16}$/;

    if (!passwordRegex.test(newPassword)) {
      setError("Password must be 8-16 chars, include 1 uppercase, 1 number, and 1 symbol.");
      return;
    }

    if (confirmPassword && newPassword !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setError("");
  }, [newPassword, confirmPassword]);

  const handleSubmit = () => {
    if (error || !currentPassword || !newPassword || !confirmPassword) return;
    onSubmit({ oldPassword: currentPassword, newPassword });
  };

  const getBorderClass = (value) => {
    if (!value) return "border";
    return error ? "border-red-500" : "border-green-500";
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl w-[90%] max-w-[400px] p-6 shadow-xl relative">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold">Change Password</h2>
          <button onClick={onClose} className="text-black text-lg font-bold">×</button>
        </div>

        <div className="flex flex-col gap-4">

          {/* Current Password */}
          <div>
            <label className="block text-sm font-medium mb-1">Current Password</label>
            <div className="relative">
              <input
                type={showCurrent ? "text" : "password"}
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value.replace(/\s/g, ""))}
                onKeyDown={(e) => e.key === " " && e.preventDefault()}
                className={`w-full rounded-lg px-3 py-2 pr-10 focus:outline-none focus:ring-2 ${getBorderClass(currentPassword)} focus:ring-yellow-500`}
              />

              <button
                type="button"
                onClick={() => setShowCurrent(!showCurrent)}
                className="absolute right-3 top-2 text-sm text-gray-600"
              >
                {showCurrent ? "Hide" : "Show"}
              </button>
            </div>
          </div>

          {/* New Password */}
          <div>
            <label className="block text-sm font-medium mb-1">New Password</label>
            <div className="relative">
              <input
                type={showNew ? "text" : "password"}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value.replace(/\s/g, ""))}
                onKeyDown={(e) => e.key === " " && e.preventDefault()}
                className={`w-full rounded-lg px-3 py-2 pr-10 focus:outline-none focus:ring-2 ${getBorderClass(newPassword)} focus:ring-yellow-500`}
              />

              <button
                type="button"
                onClick={() => setShowNew(!showNew)}
                className="absolute right-3 top-2 text-sm text-gray-600"
              >
                {showNew ? "Hide" : "Show"}
              </button>
            </div>
          </div>

          {/* Confirm Password */}
          <div>
            <label className="block text-sm font-medium mb-1">Confirm New Password</label>
            <div className="relative">
              <input
                type={showConfirm ? "text" : "password"}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value.replace(/\s/g, ""))}
                onKeyDown={(e) => e.key === " " && e.preventDefault()}
                className={`w-full rounded-lg px-3 py-2 pr-10 focus:outline-none focus:ring-2 ${getBorderClass(confirmPassword)} focus:ring-yellow-500`}
              />
              <button
                type="button"
                onClick={() => setShowConfirm(!showConfirm)}
                className="absolute right-3 top-2 text-sm text-gray-600"
              >
                {showConfirm ? "Hide" : "Show"}
              </button>
            </div>
          </div>

          {error && <p className="text-red-500 text-sm">{error}</p>}

          <Button
            onClick={handleSubmit}
            disabled={!!error}
            className={`rounded-lg px-4 py-2 mt-2 w-full ${
              error
                ? "bg-gray-400 cursor-not-allowed"
                : "bg-black text-white hover:bg-gray-800"
            }`}
          >
            Change Password
          </Button>
        </div>
      </div>
    </div>
  );
}
