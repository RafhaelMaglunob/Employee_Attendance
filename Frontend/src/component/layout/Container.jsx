import React from "react";
import clsx from "clsx";

const baseStyle = {
    sidebar: "px-2 py-2 w-64 min-h-screen bg-[#FFC629] sm:text-sm font-inter flex flex-col",
};

export function Sidebar({ children, className }) {
    return (
        <div className={clsx(baseStyle["sidebar"], className)}>
            {children}
        </div>
    );
}
