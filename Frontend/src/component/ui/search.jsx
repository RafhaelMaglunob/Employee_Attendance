import { useState } from "react";
export function Search({ value, onChange, placeholder = "Search...", className }) {
    return (
        <input
            type="text"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={placeholder}
            className={`w-full px-4 py-2 border border-gray-300 rounded-lg text-sm
                        focus:outline-none focus:ring-2 focus:ring-[#FFC629] focus:border-transparent
                        bg-white text-gray-700 ${className || ""}`}
        />
    );
}
