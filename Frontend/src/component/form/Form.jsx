// Form.jsx
import React from "react";
import { Button } from "../ui/button";

export function Form({ 
    title, 
    fields = [], 
    onSubmit, 
    submitText = "Submit", 
    cancelText, 
    onCancel,
    errorText
}) {
    return (
        <div className="rounded-xl p-6 w-full">
            {title && <h2 className="text-2xl font-semibold mb-6">{title}</h2>}

            <form
                onSubmit={(e) => {
                    e.preventDefault();
                    const formData = new FormData(e.target);
                    const data = Object.fromEntries(formData);
                    onSubmit(data);
                }}
                className="grid grid-cols-1 md:grid-cols-2 gap-2"
            >
                {fields.map((field, idx) => {
                    // Section with subfields
                    if (field.section && field.fields) {
                        // Map col number to Tailwind classes
                        const colsClass = {
                            1: "md:grid-cols-1",
                            2: "md:grid-cols-2",
                            3: "md:grid-cols-3",
                            4: "md:grid-cols-4",
                        }[field.col || 2]; // default 2 columns

                        return (
                            <React.Fragment key={idx}>
                                {/* Section title */}
                                <div className="col-span-1 md:col-span-2 mt-5">
                                    <h3 className="text-sm font-semibold">{field.section}</h3>
                                </div>

                                {/* Section fields grid */}
                                <div className={`col-span-1 md:col-span-2 grid grid-cols-1 ${colsClass} gap-2`}>
                                    {field.fields.map((subField, subIdx) => (
                                        <div
                                            key={subIdx}
                                            className={`flex flex-col w-full ${subField.fullWidth ? `col-span-1 ${colsClass}` : "col-span-1"}`}
                                        >
                                            <label className="text-sm font-medium mb-1">
                                                {subField.label} {subField.required ?? true ? "*" : ""}
                                            </label>

                                            {subField.type === "select" ? (
                                                <select
                                                    name={subField.name}
                                                    disabled={field.disabled}
                                                    defaultValue={subField.defaultValue || ""}
                                                    required={subField.required ?? true}
                                                    className={`
                                                        ${field.disabled ? "appearance-none" : "cursor-pointer"}
                                                        w-full bg-white border border-gray-300 rounded-lg px-3 h-9 focus:outline-none focus:ring-2 focus:ring-blue-500
                                                    `}
                                                >
                                                    {subField.options?.map((opt, i) => (
                                                        <option key={i} value={opt}>{opt}</option>
                                                    ))}
                                                </select>
                                            ) : (
                                                <input
                                                    type={subField.type || "text"}
                                                    name={subField.name}
                                                    disabled={field.disabled}
                                                    placeholder={subField.placeholder || ""}
                                                    defaultValue={subField.defaultValue || ""}
                                                    required={subField.required ?? true}
                                                    className="w-full bg-white border border-gray-300 rounded-lg px-3 h-9 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                                />
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </React.Fragment>
                        );
                    }

                    // Regular field
                    return (
                        <div
                            key={idx}
                            className={`flex flex-col w-full ${field.fullWidth ? "col-span-1 md:col-span-2" : "col-span-1"}`}
                        >
                            <label className="text-sm font-medium mb-1">
                                {field.label} {field.required ?? true ? "*" : ""}
                            </label>

                            {field.type === "select" ? (
                                <select
                                    name={field.name}
                                    disabled={field.disabled}
                                    defaultValue={field.defaultValue || ""}
                                    required={field.required ?? true}
                                    className={`
                                        ${field.disabled ? "appearance-none" : "cursor-pointer"} 
                                        w-full bg-white border border-gray-300 rounded-lg px-3 h-9 focus:outline-none focus:ring-2 focus:ring-blue-500`}
                                >
                                    {field.options?.map((opt, i) => (
                                        <option key={i} value={opt}>{opt}</option>
                                    ))}
                                </select>
                            ) : (
                                <input
                                    type={field.type || "text"}
                                    name={field.name}
                                    disabled={field.disabled}
                                    placeholder={field.placeholder || ""}
                                    defaultValue={field.defaultValue || ""}
                                    required={field.required ?? true}
                                    className="w-full bg-white border border-gray-300 rounded-lg px-3 h-9 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                />
                            )}
                        </div>
                    );
                })}
                
                <div className="col-span-1 md:col-span-2 flex align-center justify-center border-t mt-4  font-bold text-lg">
                    {errorText && <p className="text-red-600 mt-2 align-center">{errorText}</p>}
                </div>
                {/* Footer Buttons */}
                <div className="col-span-1 md:col-span-2 flex justify-end gap-2 pt-4">
                    {onCancel && (
                        <Button
                            type="button"
                            onClick={onCancel}
                            className="px-4 py-1 rounded-lg bg-white border-2 text-gray-700 hover:bg-white/70"
                        >
                            {cancelText || "Cancel"}
                        </Button>
                    )}
                    {submitText &&
                        <Button
                            type="submit"
                            className={`
                                px-4 py-1 border border-black rounded-lg bg-black text-white hover:bg-black/60
                            `}
                        >
                            {submitText}
                        </Button>
                    }
                </div>
            </form>
        </div>
    );
}
