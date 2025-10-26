import React from "react";
import clsx from "clsx";

const baseStyle = {
    sidebar: "px-2 py-2 w-64 min-h-screen sm:text-sm font-inter flex flex-col",
};
const roles = {
    hr: "bg-[#FFC629]",
    admin: "bg-[#FFC629]"
}

export function Sidebar({ role, children, className }) {
    return (
        <div className={clsx(baseStyle["sidebar"], roles[role], className )}>
            {children}
        </div>
    );
}
