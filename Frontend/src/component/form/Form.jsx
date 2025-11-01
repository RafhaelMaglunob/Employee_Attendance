// Form.jsx
import React, { useState } from "react";
import { Button } from "../ui/button";

export function Form({
	title,
	fields = [],
	onSubmit,
	disabled = false,
	submitText = "Submit",
	cancelText,
	onCancel,
	onFieldChange,
	formValues = {}, // controlled values from parent
	errorText = {},  // object like { email: "Invalid email" } or string for global errors
	contracts,
	phoneField = [],
}) {
	const isPhoneField = (name) => phoneField?.includes(name);


	const getInputClass = (disabled) =>
		`w-full border rounded-lg px-3 h-9 focus:outline-none ${
			disabled
				? "bg-gray-100 border-gray-300 text-gray-500 cursor-not-allowed"
				: "bg-white border-gray-300 text-black cursor-text focus:ring-2 focus:ring-blue-500"
		}`;

	const getSelectClass = (disabled) =>
		`w-full border rounded-lg px-3 h-9 focus:outline-none ${
			disabled
				? "bg-gray-100 border-gray-300 text-gray-500 cursor-not-allowed  appearance-none"
				: "bg-white border-gray-300 text-black cursor-pointer focus:ring-2 focus:ring-blue-500"
		}`;

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
					if (field.section && field.fields) {
						const colsClass = {
							1: "md:grid-cols-1",
							2: "md:grid-cols-2",
							3: "md:grid-cols-3",
							4: "md:grid-cols-4",
						}[field.col || 2];

						return (
							<React.Fragment key={idx}>
								<div className="col-span-1 md:col-span-2 mt-5">
									<h3 className="text-sm font-semibold">{field.section}</h3>
								</div>

								<div className={`col-span-1 md:col-span-2 grid grid-cols-1 ${colsClass} gap-2`}>
									{field.fields.map((subField, subIdx) => {
										const disabled = subField.disabled || field.disabled;
										return (
											<div
												key={subIdx}
												className={`flex flex-col w-full ${
													subField.fullWidth ? `col-span-1 ${colsClass}` : "col-span-1"
												}`}
											>
												<label className="text-sm font-medium mb-1">
													{subField.label} {subField.required ?? true ? "*" : ""}
												</label>

												{subField.type === "select" ? (
													<select
														name={subField.name}
														disabled={disabled}
														value={formValues[subField.name] ?? ""}
														required={subField.required ?? true}
														onChange={(e) => onFieldChange?.(subField.name, e.target.value)}
														className={getSelectClass(disabled)}
													>
														{subField.options?.map((opt, i) =>
															typeof opt === "string" ? (
																<option key={i} value={opt}>
																	{opt}
																</option>
															) : (
																<option key={i} value={opt.value} disabled={opt.disabled}>
																	{opt.label}
																</option>
															)
														)}
													</select>
												) : isPhoneField(subField.name) ? (
													<input
														type={subField.type || "text"}
														name={subField.name}
														disabled={disabled}
														placeholder={subField.placeholder || "09XX XXX XXXX"}
														value={formValues[subField.name] ?? ""}
														required={subField.required ?? true}
														onChange={(e) => {
															let v = e.target.value.replace(/\D/g, ""); // only digits
															if (v.length > 10) v = v.slice(0, 10);    // max 10 digits

															// ensure it starts with 09
															if (!v.startsWith("09")) {
																v = "09" + v.slice(2); // keep first two digits as 09
															}

															// format as 09XX XXX XXXX
															let formatted = v.slice(0, 4);
															if (v.length > 4) formatted += " " + v.slice(4, 7);
															if (v.length > 7) formatted += " " + v.slice(7, 10);

															onFieldChange?.(subField.name, formatted);
														}}
														className={getInputClass(disabled)}
													/>
												) : (
													<input
														type={subField.type || "text"}
														name={subField.name}
														disabled={disabled}
														placeholder={subField.placeholder || ""}
														value={formValues[subField.name] ?? ""}
														required={subField.required ?? true}
														onChange={(e) => onFieldChange?.(subField.name, e.target.value)}
														className={getInputClass(disabled)}
													/>
												)}

												{errorText?.[subField.name] && (
													<span className="text-xs text-red-500 mt-1">{errorText[subField.name]}</span>
												)}
											</div>
										);
									})}
								</div>
							</React.Fragment>
						);
					}

					const disabled = field.disabled;

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
									disabled={disabled}
									value={formValues[field.name] ?? ""}
									required={field.required ?? true}
									onChange={(e) => onFieldChange?.(field.name, e.target.value)}
									className={getSelectClass(disabled)}
								>
									{field.options?.map((opt, i) =>
										typeof opt === "string" ? (
											<option key={i} value={opt}>
												{opt}
											</option>
										) : (
											<option key={i} value={opt.value} disabled={opt.disabled}>
												{opt.label}
											</option>
										)
									)}
								</select>
							) : isPhoneField(field.name) ? (
								<input
									type={field.type || "text"}
									name={field.name}
									disabled={disabled}
									placeholder={field.placeholder || "09XX XXX XXXX"}
									value={formValues[field.name] ?? ""}
									required={field.required ?? true}
									onChange={(e) => {
										let v = e.target.value.replace(/\D/g, ""); // remove non-digits
										if (v.length > 10) v = v.slice(0, 10);    // max 10 digits

										// ensure starts with 09
										if (!v.startsWith("09")) {
											v = "09" + v.slice(2);
										}

										// format as 09XX XXX XXXX
										let formatted = v.slice(0, 4);
										if (v.length > 4) formatted += " " + v.slice(4, 7);
										if (v.length > 7) formatted += " " + v.slice(7, 10);

										onFieldChange?.(field.name, formatted);
									}}
									className={getInputClass(disabled)}
								/>
							) : (
								<input
									type={field.type || "text"}
									name={field.name}
									disabled={disabled}
									placeholder={field.placeholder || ""}
									value={formValues[field.name] ?? ""}
									required={field.required ?? true}
									onChange={(e) => onFieldChange?.(field.name, e.target.value)}
									className={getInputClass(disabled)}
								/>
							)}

							{errorText?.[field.name] && (
								<span className="text-xs text-red-500 mt-1">{errorText[field.name]}</span>
							)}
						</div>
					);
				})}

				{/* Contracts slot */}
				{contracts && <div className="col-span-1 md:col-span-2 w-full flex flex-col">{contracts}</div>}

				{/* Global error display */}
				{typeof errorText === "string" && errorText.length > 0 && (
					<div className="col-span-1 md:col-span-2 flex justify-center mt-4 font-bold text-sm text-red-600">
						{errorText}
					</div>
				)}


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
					{submitText && (
						<Button
							type="submit"
							disabled={disabled}
							className="px-4 py-1 border border-black rounded-lg bg-black text-white hover:bg-black/60"
						>
							{submitText}
						</Button>
					)}
				</div>
			</form>
		</div>
	);
}

const defaultClasses = {
  base: "w-full px-3 py-4 border rounded-md cursor-pointer",
  textarea: "h-32 text-xl",
  select: "w-full px-3 py-4 border rounded-md bg-white cursor-pointer",
  buttonGroupWrapper: "w-full h-full border rounded-md flex items-center",
  buttonGroupButton: "flex-1 px-3 py-2",
};

export default function DynamicForm({ fields, formValues, onFieldChange, onSubmit, isSubmitting }) {
  const [errors, setErrors] = useState({});

  const handleChange = (name, value) => {
    if (isSubmitting) return;
    const newFormValues = { ...formValues, [name]: value };
    onFieldChange?.(name, value);

    const newErrors = { ...errors };

    fields.forEach(field => {
      switch (field.type) {
        case "date":
          const start = newFormValues.startDate ? new Date(newFormValues.startDate) : null;
          const end = newFormValues.endDate ? new Date(newFormValues.endDate) : null;
          const current = newFormValues[field.name] ? new Date(newFormValues[field.name]) : null;

          if (!current) {
            newErrors[field.name] = `${field.label} is required.`;
          } else if (field.min && current < new Date(field.min)) {
            newErrors[field.name] = `${field.label} cannot be before ${field.min}.`;
          } else if (field.name === "endDate" && start && current <= start) {
            newErrors[field.name] = "End Date must be after Start Date.";
          } else if (field.name === "startDate" && end && current >= end) {
            newErrors[field.name] = "Start Date must be before End Date.";
          } else {
            newErrors[field.name] = "";
          }
          break;

        case "number":
          if (field.min && value < field.min) newErrors[field.name] = `${field.label} must be at least ${field.min}.`;
          else if (field.max && value > field.max) newErrors[field.name] = `${field.label} cannot exceed ${field.max}.`;
          else newErrors[field.name] = "";
          break;

        case "textarea":
        case "text":
        default:
          if (field.required && !value) newErrors[field.name] = `${field.label} is required.`;
          else newErrors[field.name] = "";
          break;
      }
    });

    setErrors(newErrors);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (isSubmitting) return;

    let valid = true;
    const newErrors = {};

    fields.forEach(field => {
      const value = formValues[field.name];

      switch (field.type) {
        case "date":
          const start = formValues.startDate ? new Date(formValues.startDate) : null;
          const end = formValues.endDate ? new Date(formValues.endDate) : null;
          const current = value ? new Date(value) : null;

          if (!current) {
            valid = false;
            newErrors[field.name] = `${field.label} is required.`;
          } else if (field.min && current < new Date(field.min)) {
            valid = false;
            newErrors[field.name] = `${field.label} cannot be before ${field.min}.`;
          } else if (field.name === "endDate" && start && current <= start) {
            valid = false;
            newErrors[field.name] = "End Date must be after Start Date.";
          } else if (field.name === "startDate" && end && current >= end) {
            valid = false;
            newErrors[field.name] = "Start Date must be before End Date.";
          }
          break;

        case "number":
          if (field.min && value < field.min) {
            valid = false;
            newErrors[field.name] = `${field.label} must be at least ${field.min}.`;
          } else if (field.max && value > field.max) {
            valid = false;
            newErrors[field.name] = `${field.label} cannot exceed ${field.max}.`;
          }
          break;

        default:
          if (field.required && !value) {
            valid = false;
            newErrors[field.name] = `${field.label} is required.`;
          }
          break;
      }
    });

    setErrors(newErrors);
    if (!valid) return;

    onSubmit?.(formValues);
  };

  return (
    <form className="flex flex-col space-y-3" onSubmit={handleSubmit}>
      <div className="grid grid-cols-2 gap-3">
        {fields.map(field => {
          const value = formValues[field.name] ?? "";
          const error = errors[field.name];
          const disabled = field.disabled || isSubmitting;

          switch (field.type) {
            case "textarea":
              return (
                <div key={field.name} className="flex flex-col space-y-1 col-span-2">
                  <label>{field.label}</label>
                  <textarea
                    value={value}
                    onChange={e => handleChange(field.name, e.target.value)}
                    disabled={disabled}
                    className={`${defaultClasses.base} ${defaultClasses.textarea} ${error ? "border-red-500" : ""} ${disabled ? "bg-gray-100 cursor-not-allowed" : ""}`}
                  />
                  {error && <span className="text-red-500 text-sm">{error}</span>}
                </div>
              );

            case "select":
              return (
                <div key={field.name} className={`flex flex-col space-y-1 ${field.fullWidth ? "col-span-2" : ""}`}>
                  <label>{field.label}</label>
                  <select
                    value={value}
                    onChange={e => handleChange(field.name, e.target.value)}
                    disabled={disabled}
                    className={`${defaultClasses.select} ${error ? "border-red-500" : ""} ${disabled ? "bg-gray-100 cursor-not-allowed" : ""}`}
                  >
                    <option value="" disabled>Select Option</option>
                    {field.options.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                  </select>
                  {error && <span className="text-red-500 text-sm">{error}</span>}
                </div>
              );

            default:
              return (
                <div key={field.name} className={`flex flex-col space-y-1 ${field.fullWidth ? "col-span-2" : ""}`}>
                  <label>{field.label}</label>
                  <input
                    type={field.type || "text"}
                    value={value}
                    onChange={e => handleChange(field.name, e.target.value)}
                    disabled={disabled}
                    min={field.min}
                    max={field.max}
                    className={`${defaultClasses.base} ${error ? "border-red-500" : ""} ${disabled ? "bg-gray-100 cursor-not-allowed text-gray-500" : ""}`}
                  />
                  {error && <span className="text-red-500 text-sm">{error}</span>}
                </div>
              );
          }
        })}
      </div>

      <button
        type="submit"
        className={`w-full py-4 text-lg font-semibold rounded-md mt-5 bg-black text-white ${isSubmitting ? "opacity-70 cursor-not-allowed" : ""}`}
        disabled={isSubmitting}
      >
        {isSubmitting ? "...Submitting" : "Submit"}
      </button>
    </form>
  );
}