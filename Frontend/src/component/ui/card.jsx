// DashboardCard.jsx
import React from "react";
import clsx from 'clsx';
const variants = {
  admin: {
    title: "bg-red-600 text-white px-4 py-2 text-sm font-semibold flex items-center gap-2 border-b-1 border-b-[#5E451D]",
    body: "bg-yellow-400 flex flex-col shadow-[8px_8px_0_#5E451D] font-inter",
  },
  default: {
    title:
      "bg-gray-100 text-gray-800 px-4 py-2 text-sm font-semibold flex items-center gap-2",
    body:
      "bg-white flex flex-col border border-gray-200 font-inter",
  },
}

export function Card({
  title,
  variant = "default",
  radius = "lg",
  header,
  children,
  footer,
  hasButton = false,
  width = "full",
  className = "",
}) {
  return (
    <div
      className={clsx(
        variants[variant].body,
        width === "full" ? "w-full" : `w-${width}`,
        `flex flex-col font-inter`,
        `rounded-${radius}`,
        className
       )}
    >
      {/* Header */}
      {(title || header) && (
        <div className={clsx(
          variants[variant].title,
          "px-4 py-2 border-b bg-gray-100 w-full"
          )}>
          {title && <h2 className="text-sm font-semibold mb-1">{title}</h2>}
          {header}
        </div>
      )}


      {/* Body */}
      <div className="flex-1 p-4">{children}</div>

      {/* Footer */}
      {hasButton && (
        <div className="px-4 py-3 border-t">
          <button className="w-full bg-black text-white py-2 rounded-md text-xs hover:bg-gray-800 transition">
            {footer || "Click Me"}
          </button>
        </div>
      )}
    </div>
  );
}
