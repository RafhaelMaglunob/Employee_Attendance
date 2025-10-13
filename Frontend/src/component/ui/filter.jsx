import { useState } from 'react'


export function Filter({ value, onChange, className, noIcon = false, sortable = false, children }) {
    const [open, setOpen] = useState(false);

    return (
        <div
            className={`relative flex items-center items-center bg-white rounded-md px-3 gap-2 border border-gray-300 cursor-pointer ${className || ""}`}
            onClick={() => setOpen(!open)}
        >
            <div className="py-2 flex flex-row space-x-3">
                {!noIcon && <img src="../../../img/Filter_Icon.png" alt="Filter" className="w-4 h-4" />}
                <span className={`text-sm text-gray-800 w-full ${!noIcon ? "hidden sm:flex" : ""}`}>
                    {value || "Filter"}
                </span>
            </div>

            {open && (
                <div className="absolute top-full left-0 w-full mt-1 px-2 py-1 bg-white rounded-md shadow-md border border-gray-200 z-10 max-h-40 overflow-y-auto">
                    {children}
                </div>
            )}
        </div>
    );
}