// ModalCard.jsx
import React from "react";
import clsx from "clsx";
import { Card } from "./card";

export function ModalContainer({ 
    title,
    footerText = "", 
    titleSize,
    onClose,
    variant,
    children, 
    width = "lg", 
    className = "" 
}) {
  // Map width prop to Tailwind classes
    const widthClasses = {
        sm: "max-w-sm",
        md: "max-w-md",
        lg: "max-w-lg",
        xl: "max-w-xl",
        "2xl": "max-w-2xl",
        "3xl": "max-w-3xl",
        full: "max-w-full",
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
            <div className={clsx("max-h-[80vh] overflow-y-auto w-full p-4", widthClasses[width])}>
                <Card
                    title={title}
                    titleSize={titleSize}
                    variant={variant}
                    radius="none"
                    hasButton={!!footerText}
                    footer={footerText}
                    className={className}
                >
                    {children}
                </Card>
            </div>
        </div>
    );
}
