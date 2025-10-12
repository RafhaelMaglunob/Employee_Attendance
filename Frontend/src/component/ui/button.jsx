import React from 'react'
import clsx from 'clsx'

const baseStyle="inline-flex items-center justify-center transition-colors cursor-pointer focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed"

const variants = {
    sidebar: "w-full h-10 text-left px-2 py-1 text-gray-700 rounded-xl hover:bg-gray-100/40 focus:bg-gray-200/70",
};


export function Button({variant="", className, children, ...props}) {
    return (
        <button 
            className={
                clsx(
                    baseStyle,
                    variants[variant],
                    className
                )
            }
            {...props}
        >
            {children}
        </button>
    )
}

