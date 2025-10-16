import React from "react";
import clsx from "clsx";

const variants = {
    admin: "w-full h-15 bg-[#FFC629]",
    hr: "w-full h-15 bg-[#FFC629]",
}


export function NavBar({ children, className, variant }) {
    return (
        <div className={clsx(variants[variant], className)}>
            {children}
        </div>
    );
}
