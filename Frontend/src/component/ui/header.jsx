import React, { useState, useRef, useEffect } from 'react';

export default function Headers({ onLogout, children, addSVG = false, userRole, userEmail }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (ref.current && !ref.current.contains(event.target)) {
        setOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="relative flex items-center rounded-full cursor-pointer "
      >
        {children}

        {/* Arrow positioned at bottom-right of the profile icon */}
        {addSVG &&
          <svg
            className={`absolute bottom-0 right-0 w-3 h-3 bg-white rounded-full p-[1px] transition-transform duration-200 
              ${open ? "rotate-180" : "rotate-0"}
            `}
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        } 
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-40 bg-white shadow-lg rounded-lg p-3 space-y-2 z-10">
          <div className="border-b pb-2 relative group">
            <p className="text-base font-semibold truncate">{userRole}</p>

            <div className="relative inline-block max-w-[150px]">
              <p className="text-xs text-gray-500 truncate">
                {userEmail}
              </p>

              {/* Tooltip */}
              <div className="absolute left-[-50px] bottom-full mb-1 hidden bg-white text-black text-xs px-2 py-1 rounded shadow-lg whitespace-nowrap z-50 group-hover:block">
                {userEmail}
              </div>
            </div>
          </div>


          <div className="flex flex-row space-x-2 items-center">
            <img
              src="../img/Settings_Icon.png"
              alt="Settings Icon"
              className="w-5 h-5"
            />
            <button className="w-full text-left text-sm hover:underline">
              Settings
            </button>
          </div>

          <div className="flex flex-row space-x-2 items-center">
            <img
              src="../img/Logout_Icon.png"
              alt="Logout Icon"
              className="w-5 h-5"
            />
            <button
              onClick={onLogout} 
              className="w-full text-left text-sm text-red-600 hover:underline"
            >
              Logout
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
