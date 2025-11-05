import React from 'react';
import clsx from 'clsx';
const variants = {
  hr: {
    title: "bg-red-600 text-white px-4 py-2 text-sm font-semibold flex items-center gap-2 border-b border-b-gray-800",
    body: "bg-[#FFC629] flex flex-col shadow-[8px_8px_0_#111827] font-inter text-black",
  },
  admin: {
    title: "bg-red-600 text-white px-4 py-2 text-sm font-semibold flex items-center gap-2",
    body: "bg-[#FFC629] flex flex-col shadow-[8px_8px_0_#111827] font-inter text-black",
  },
  default: {
    title: "bg-red-600 text-white px-4 py-2 text-sm font-semibold flex items-center gap-2 border-b border-b-gray-800",
    body: "bg-[#FFC629] flex flex-col shadow-[8px_8px_0_#111827] font-inter text-black",
  },

}

const titleSizes = {
  sm: "text-sm",
  md: "text-md",
  lg: "text-lg",
  xl: "text-xl",
  "2xl": "text-xl",
  "3xl": "text-2xl"
}

export function Card({
  title,
  titleSize,
  variant = "default",
  radius = "lg",
  header,
  children,
  footer,
  footerLabel,
  hasButton = false,
  width = "full",
  className = "",
  onClick,
}) {
  return (
    <div
      className={clsx(
        variants[variant].body,
        width === "full" ? "w-full" : `w-${width}`,
        `flex flex-col font-inter`,
        `rounded-${radius}`,
        className,
        onClick ? "cursor-pointer" : ""
       )}
       onClick={hasButton ? undefined : onClick}
    >
      {/* Header */}
      {(title || header) && (
        <div className={clsx(
          variants[variant].title,
          "px-4 py-2 border-b w-full"
          )}>
          {title && <h2 className={`${titleSizes[titleSize] || "text-sm"} font-semibold mb-1`}>{title}</h2>}
          {header}
        </div>
      )}


      {/* Body */}
      <div className={`flex-1 p-4`}>{children}</div>

      {/* Footer */}
      {hasButton && (
        <div className="px-4 py-3 border-t">
          <button 
            onClick={onClick}
            className="w-full bg-black text-white py-2 rounded-md text-xs hover:bg-gray-800 transition">
            {footer || "Click Me"}
          </button>
        </div>
      )}
      <div>
        {footerLabel}
      </div>
    </div>
  );
}