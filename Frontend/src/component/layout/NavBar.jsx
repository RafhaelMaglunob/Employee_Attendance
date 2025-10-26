import React from "react";
import clsx from "clsx";

const variants = {
    admin: "w-full h-15 border-b border-gray-100",
    hr: "w-full h-15 bg-[#FFC629]",
    'head staff': "w-full h-15 bg-[#FFC629]",
    default: "w-full h-15 bg-[#FFC629]"
}


export function NavBar({ children, className, variant = "default" }) {
    return (
        <div className={clsx(variants[variant], className)}>
            {children}
        </div>
    );
}
