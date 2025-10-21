import { useState, useRef, useEffect } from 'react';

export function Filter({ value = "Filter", onChange, className, noIcon = false, sortable = false, children }) {
    const [open, setOpen] = useState(false);
    const containerRef = useRef(null);

    // Close dropdown when clicking outside
    useEffect(() => {
        function handleClickOutside(event) {
            if (containerRef.current && !containerRef.current.contains(event.target)) {
                setOpen(false);
            }
        }

        document.addEventListener('mousedown', handleClickOutside);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, []);

    return (
        <div
            ref={containerRef}
            className={`relative flex items-center bg-white rounded-md px-3 gap-2 border border-gray-300 cursor-pointer ${className || ""}`}
            onClick={() => setOpen(!open)}
        >
            <div className="py-2 flex flex-row space-x-3 w-full items-center">
                {!noIcon && value === "Filter" && (
                    <img
                        src="../../../img/Filter_Icon.png"
                        alt="Filter"
                        className="w-4 h-4 flex-shrink-0"
                    />
                )}
                <span
                    className={`
                        text-sm text-gray-800 truncate w-[90px] 
                        ${!noIcon ? "hidden sm:flex" : ""}
                    `}
                    title={value}
                >
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
