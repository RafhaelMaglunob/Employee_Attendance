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

export function Filter({ value, onChange, options = [""], className, sortable = false }) {
    const [open, setOpen] = useState(false);

    // Only add ASC/DESC if sortable
    const finalOptions = sortable ? [...options, "ASC", "DESC"] : options;

    const handleSelect = (opt) => {
        onChange(opt);  // update parent value
        setOpen(false);
    };

    return (
        <div
            className={`relative flex items-center bg-white rounded-md px-3 gap-2 border border-gray-300 
                        cursor-pointer ${className || ""}`}
            onClick={() => setOpen(!open)}
        >
            <div className="py-2 flex flex-row space-x-3">
                <img src="../../../img/Filter_Icon.png" alt="Filter" className="w-4 h-4" />
                <span className="text-sm text-gray-800 w-full hidden sm:flex">
                    {value || "Filter"}
                </span>
            </div>

            {open && (
                <div
                    className="absolute top-full left-0 w-full mt-1 bg-white rounded-md shadow-md border border-gray-200 z-10"
                >
                    {finalOptions.map((opt, i) => (
                        <div
                            key={i}
                            className={`px-3 py-2 text-sm text-black hover:bg-gray-100 
                                        ${value === opt ? "bg-gray-200 font-bold" : ""}`}
                            onClick={() => handleSelect(opt)}
                        >
                            {opt}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}