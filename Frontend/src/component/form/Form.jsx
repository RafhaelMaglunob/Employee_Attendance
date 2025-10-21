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
	onFieldChange,
	formValues = {}, // controlled values from parent
	errorText = {},  // object like { email: "Invalid email" } or string for global errors
	contracts,
	phoneField = [],
}) {
	const isPhoneField = (name) => phoneField?.includes(name);

	const withoutPlus63 = (val) =>
		typeof val === "string" ? val.replace(/^\+63\s*/, "") : "";

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
													<div className="relative">
														<span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-gray-700 select-none">
															+63
														</span>
														<input
															type={subField.type || "text"}
															name={subField.name}
															disabled={disabled}
															placeholder={subField.placeholder || "XXX XXX XXXX"}
															value={withoutPlus63(formValues[subField.name])}
															required={subField.required ?? true}
															onChange={(e) => onFieldChange?.(subField.name, e.target.value)}
															className={`${getInputClass(disabled)} pl-14`}
														/>
													</div>
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
								<div className="relative">
									<span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-gray-700 select-none">
										+63
									</span>
									<input
										type={field.type || "text"}
										name={field.name}
										disabled={disabled}
										placeholder={field.placeholder || "XXX XXX XXXX"}
										value={withoutPlus63(formValues[field.name])}
										required={field.required ?? true}
										onChange={(e) => onFieldChange?.(field.name, e.target.value)}
										className={`${getInputClass(disabled)} pl-14`}
									/>
								</div>
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
