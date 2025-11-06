import { useState, useMemo, useRef, useEffect } from "react";
import { ModalContainer } from "../ui/modal";
import { Form } from "../form/Form";
import * as XLSX from "xlsx";
import ConfirmModal from "./ConfirmModal";
import MessageModal from "./MessageModal";

export default function AddEmployeeModal({ isOpen, onClose, pushData }) {
	const [formValues, setFormValues] = useState({});
	const [fieldErrors, setFieldErrors] = useState({});
	const [isSubmitting, setIsSubmitting] = useState(false);
	const [excelFile, setExcelFile] = useState(null);
	const [excelRows, setExcelRows] = useState([]);
	const [currentExcelIndex, setCurrentExcelIndex] = useState(0);
	const [showConfirm, setShowConfirm] = useState(false);
	const [showMessage, setShowMessage] = useState(false);
	const [messageText, setMessageText] = useState("");
	const [messageType, setMessageType] = useState("success");
	const [confirmAction, setConfirmAction] = useState(null);
	const excelInputRef = useRef(null);

	useEffect(() => {
		if (excelRows.length > 0) {
			setCurrentExcelIndex(0);
			setFormValues(mapExcelRowToForm(excelRows[0]));
		}
	}, [excelRows]);

	const formatSSS = (val) => {
		val = val.replace(/\D/g, "").slice(0, 10);
		if (val.length > 2 && val.length <= 9) val = val.slice(0, 2) + "-" + val.slice(2);
		if (val.length > 9) val = val.slice(0, 2) + "-" + val.slice(2, 9) + "-" + val.slice(9);
		return val;
	};

	const formatPagibig = (val) => {
		val = val.replace(/\D/g, "").slice(0, 12);
		if (val.length > 4 && val.length <= 8) val = val.slice(0, 4) + "-" + val.slice(4);
		if (val.length > 8) val = val.slice(0, 4) + "-" + val.slice(4, 8) + "-" + val.slice(8);
		return val;
	};

	const formatPhilhealth = (val) => {
		val = val.replace(/\D/g, "").slice(0, 12);
		if (val.length > 2 && val.length <= 11) val = val.slice(0, 2) + "-" + val.slice(2);
		if (val.length > 11) val = val.slice(0, 2) + "-" + val.slice(2, 11) + "-" + val.slice(11);
		return val;
	};

	const formatPhoneNumber = (val) => {
		if (!val) return "";
		val = val.toString().replace(/\D/g, "").slice(0, 11);
		if (!val.startsWith("09")) val = "09" + val.slice(2);

		let formatted = "";
		if (val.length > 0) formatted += val.slice(0, 4);
		if (val.length > 4) formatted += " " + val.slice(4, 7);
		if (val.length > 7) formatted += " " + val.slice(7, 11);
		return formatted;
	};

	const excelDateToJSDate = (serial) => {
		const utc_days = serial - 25569;
		const utc_value = utc_days * 86400;
		const date_info = new Date(utc_value * 1000);
		const year = date_info.getFullYear();
		const month = String(date_info.getMonth() + 1).padStart(2, "0");
		const day = String(date_info.getDate()).padStart(2, "0");
		return `${year}-${month}-${day}`;
	};

	const mapExcelRowToForm = (row) => ({
		fullname: row["Full Name"] || "",
		nickname: row["Nickname"] || "",
		email: row["Email Address"] || "",
		employment_type: row["Employment Type"] || "",
		gender: row["Gender"] || "",
		contact: formatPhoneNumber(row["Contact"]) || "",
		marital_status: row["Marital Status"] || "",
		birthday: row["Birthday"]
			? typeof row["Birthday"] === "number"
				? excelDateToJSDate(row["Birthday"])
				: new Date(row["Birthday"]).toISOString().split("T")[0]
			: "",
		address: row["Address"] || "",
		sss_number: row["SSS No."] || "",
		pagibig: row["Pagibig No."] || "",
		philhealth: row["Philhealth No."] || "",
		emergency_name: row["Emergency Fullname"] || "",
		relationship: row["Relationship"] || "",
		emergency_address: row["Emergency Address"] || "",
		emergency_contact: formatPhoneNumber(row["Emergency Contact"]) || "",
		city: row["City"] || "",
		postal_code: row["Postal Code"] || "",
		gcash_no: formatPhoneNumber(row["GCash Number"]) || "",
		start_of_contract: row["Start of Contract"] 
			? typeof row["Start of Contract"] === "number"
				? excelDateToJSDate(row["Start of Contract"])
				: new Date(row["Start of Contract"]).toISOString().split("T")[0]
			: "",
		end_of_contract: row["End of Contract"]
			? typeof row["End of Contract"] === "number"
				? excelDateToJSDate(row["End of Contract"])
				: new Date(row["End of Contract"]).toISOString().split("T")[0]
			: "",
		position: row["Position"] || "",
		status: row["Status"] || "Employed",
	});

	const preparePayload = (row) => {
		const clean = (val) => val?.toString().replace(/\D/g, "") || "";
		return {
			...row,
			contact: clean(row.contact),
			emergency_contact: clean(row.emergency_contact),
			gcash_no: clean(row.gcash_no),
			sss_number: clean(row.sss_number),
			pagibig: clean(row.pagibig),
			philhealth: clean(row.philhealth),
		};
	};

	const validateSingleField = (name, value, allValues) => {
		const phoneRegex = /^09\d{9}$/;
		const emailRegex = /^[a-zA-Z0-9._%+-]+@(gmail|yahoo|outlook|hotmail)\.(com|ph|net)$/i;
		const postalRegex = /^\d+$/;
		const today = new Date();

		switch (name) {
			case "fullname":
				if (!value.trim()) return "Full name is required";
				if (/\d/.test(value)) return "Full name cannot contain numbers";
				if (!/^[A-Za-z\s'.-]+$/.test(value)) return "Full name contains invalid characters";
				break;
			case "email":
				if (!value) return "Email is required";
				if (!emailRegex.test(value)) return "Invalid email format";
				break;
			case "contact":
			case "emergency_contact":
			case "gcash_no":
				if (value) {
					const raw = value.replace(/\D/g, "");
					if (!/^09\d{9}$/.test(raw))
						return "Phone number must start with 09 and have 9 digits after it";
				}
				break;
			case "postal_code":
				if (value && !postalRegex.test(value)) return "Postal code must be numeric";
				break;
			case "birthday":
				if (!value) return "Birthday is required";
				const bdate = new Date(value);
				if (bdate > today) return "Birthday cannot be in the future";
				const age = today.getFullYear() - bdate.getFullYear();
				if (age < 15) return "Employee must be at least 15 years old";
				break;
			case "sss_number":
				if (allValues.employment_type === "Full-Time") {
					if (!value) return "SSS No. is required";
					if (!/^\d{2}-\d{7}-\d$/.test(value)) return "SSS must be in format XX-XXXXXXX-X";
				}
				break;
			case "pagibig":
				if (allValues.employment_type === "Full-Time") {
					if (!value) return "PAG-IBIG No. is required";
					if (!/^\d{4}-\d{4}-\d{4}$/.test(value)) return "PAG-IBIG must be in format XXXX-XXXX-XXXX";
				}
				break;
			case "philhealth":
				if (allValues.employment_type === "Full-Time") {
					if (!value) return "PhilHealth No. is required";
					if (!/^\d{2}-\d{9}-\d$/.test(value)) return "PhilHealth must be in format XX-XXXXXXXXX-X";
				}
				break;
			case "start_of_contract":
			case "end_of_contract":
				if (allValues.employment_type === "Part-Time" && !value)
					return `${name.replaceAll("_", " ")} is required`;
				break;
			default:
				return "";
		}

		if (name === "end_of_contract" && allValues.start_of_contract && value) {
			const start = new Date(allValues.start_of_contract);
			const end = new Date(value);
			if (end.getTime() <= start.getTime()) return "End date must be after start date";
		}

		return "";
	};

	const handleFieldChange = (name, value) => {
		if (name === "sss_number") value = formatSSS(value);
		if (name === "pagibig") value = formatPagibig(value);
		if (name === "philhealth") value = formatPhilhealth(value);
		if (["contact", "emergency_contact", "gcash_no"].includes(name)) value = formatPhoneNumber(value);

		setFormValues((prev) => {
			const updated = { ...prev, [name]: value };
			setFieldErrors((errs) => ({ ...errs, [name]: validateSingleField(name, value, updated) }));
			return updated;
		});
	};

	const getAuthToken = () => {
		const token = document.cookie
			.split('; ')
			.find(row => row.startsWith('employee_token=') || row.startsWith('admin_token='))
			?.split('=')[1];
		return token;
	};

	const handleManualSubmit = async () => {
		setShowConfirm(false);
		setIsSubmitting(true);

		const token = getAuthToken();
		const payload = preparePayload(formValues);

		try {
			const res = await fetch("http://192.168.1.9:3001/api/employees", {
				method: "POST",
				headers: { 
					"Content-Type": "application/json",
					"Authorization": token ? `Bearer ${token}` : ""
				},
				body: JSON.stringify(payload),
			});
			
			const result = await res.json();
			console.log("📥 Response received:", result);
			
			if (res.ok && result.success) {
				console.log("✅ Employee added:", payload.fullname);
				console.log("✅ Employee ID:", result.employee?.employee_id);
				
				if (pushData) pushData();

				setFormValues({});
				setFieldErrors({});
				
				setMessageType("success");
				setMessageText(`Employee ${payload.fullname} added successfully!`);
				setShowMessage(true);
			} else {
				throw new Error(result.error || 'Failed to add employee');
			}
		} catch (err) {
			console.error("❌ Failed to add employee:", err);
			setMessageType("error");
			setMessageText(`Failed to add employee: ${err.message}`);
			setShowMessage(true);
		} finally {
			setIsSubmitting(false);
		}
	};

	const handleSubmit = async () => {
		const allErrors = {};
		Object.entries(formValues).forEach(([key, val]) => {
			const err = validateSingleField(key, val, formValues);
			if (err) allErrors[key] = err;
		});
		setFieldErrors(allErrors);
		if (Object.keys(allErrors).length > 0) return;

		// SCENARIO 1: Excel Import Mode
		if (excelRows.length > 0) {
			const updatedRows = [...excelRows];
			updatedRows[currentExcelIndex] = { ...updatedRows[currentExcelIndex], ...formValues };
			setExcelRows(updatedRows);

			// If not the last row, move to next
			if (currentExcelIndex < excelRows.length - 1) {
				const nextIndex = currentExcelIndex + 1;
				setCurrentExcelIndex(nextIndex);
				setFormValues(mapExcelRowToForm(updatedRows[nextIndex]));
				setFieldErrors({});
				return;
			}

			// Last row reached - confirm batch submission
			setConfirmAction(() => handleConfirmSubmit);
			setShowConfirm(true);
		} 
		// SCENARIO 2: Manual Entry Mode
		else {
			setConfirmAction(() => handleManualSubmit);
			setShowConfirm(true);
		}
	};

	const handleConfirmSubmit = async () => {
		setShowConfirm(false);
		setIsSubmitting(true);

		const token = getAuthToken();
		let successCount = 0;
		let failCount = 0;
		const errors = [];

		for (const row of excelRows) {
			const payload = preparePayload(mapExcelRowToForm(row));
			try {
				const res = await fetch("http://192.168.1.9:3001/api/employees", {
					method: "POST",
					headers: { 
						"Content-Type": "application/json",
						"Authorization": token ? `Bearer ${token}` : ""
					},
					body: JSON.stringify(payload),
				});
				
				const result = await res.json();
				
				if (res.ok) {
					successCount++;
					console.log("✅ Employee added:", payload.fullname);
				} else {
					failCount++;
					errors.push(`${payload.fullname}: ${result.error || 'Unknown error'}`);
					console.error("❌ Failed to add:", payload.fullname, result);
				}
			} catch (err) {
				failCount++;
				errors.push(`${payload.fullname}: ${err.message}`);
				console.error("❌ Fetch error for:", payload.fullname, err);
			}
		}

		setIsSubmitting(false);
		
		if (pushData && successCount > 0) pushData();

		// Reset form
		setExcelRows([]);
		setExcelFile(null);
		setFormValues({});
		setFieldErrors({});
		if (excelInputRef.current) excelInputRef.current.value = "";

		// Show result message
		if (failCount === 0) {
			setMessageType("success");
			setMessageText(`All ${successCount} employee(s) uploaded successfully!`);
		} else if (successCount === 0) {
			setMessageType("error");
			setMessageText(`Failed to upload all employees:\n${errors.join('\n')}`);
		} else {
			setMessageType("warning");
			setMessageText(`${successCount} succeeded, ${failCount} failed:\n${errors.join('\n')}`);
		}
		setShowMessage(true);
	};

	const handleClose = () => {
		setFormValues({});
		setFieldErrors({});
		setExcelRows([]);
		setExcelFile(null);
		if (excelInputRef.current) excelInputRef.current.value = "";
		onClose();
	};

	const handleExcelUpload = (e) => {
		const file = e.target.files[0];
		if (!file) return;
		if (!file.name.match(/\.(xls|xlsx)$/)) {
			setMessageType("error");
			setMessageText("Please upload a valid Excel file");
			setShowMessage(true);
			return;
		}
		setExcelFile(file);
		handleImportExcel(file);
	};

	const handleImportExcel = (file) => {
		const reader = new FileReader();
		reader.onload = (e) => {
			const data = new Uint8Array(e.target.result);
			const workbook = XLSX.read(data, { type: "array" });
			const sheetName = workbook.SheetNames[0];
			const sheet = workbook.Sheets[sheetName];
			const jsonData = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "" });

			if (jsonData.length === 0) return;
			const headers = jsonData[0];
			const rows = jsonData.slice(1).map((row) => {
				const obj = {};
				row.forEach((val, idx) => {
					const key = headers[idx] ? headers[idx].toString().trim() : `Column${idx}`;
					obj[key] = typeof val === "string" ? val.trim() : val;
				});
				return obj;
			});
			setExcelRows(rows);
			setFieldErrors({});
		};
		reader.readAsArrayBuffer(file);
	};

	const handleDeleteCurrent = () => {
		if (excelRows.length === 0) return;

		const updated = excelRows.filter((_, idx) => idx !== currentExcelIndex);
		setExcelRows(updated);

		if (updated.length === 0) {
			setFormValues({});
			setExcelFile(null);
			if (excelInputRef.current) excelInputRef.current.value = "";
			return;
		}

		const newIndex = Math.min(currentExcelIndex, updated.length - 1);
		setCurrentExcelIndex(newIndex);
		setFormValues(mapExcelRowToForm(updated[newIndex]));
	};

	const handleClearExcel = () => {
		setExcelRows([]);
		setExcelFile(null);
		setFormValues({});
		setFieldErrors({});
		if (excelInputRef.current) excelInputRef.current.value = "";
	};

	const fields = useMemo(() => {
		const baseFields = [
			{ name: "fullname", label: "Full Name *" },
			{
				name: "employment_type",
				label: "Employment Type *",
				type: "select",
				options: [
					{ label: "--Select Employment Type--", value: "", disabled: true, selected: true },
					{ label: "Full-Time", value: "Full-Time" },
					{ label: "Part-Time", value: "Part-Time" },
				],
			},
			{
				name: "position",
				label: "Position *",
				type: "select",
				options: [
					{ label: "--Select Position--", value: "", disabled: true, selected: true },
					{ label: "Crew", value: "Crew" },
					{ label: "Head Staff", value: "Head Staff" }
				]
			},
			{
				name: "status",
				label: "Status *",
				type: "select",
				options: [
					{ label: "--Select Status--", value: "", disabled: true, selected: true },
					{ label: "Employed", value: "Employed" },
					{ label: "Probationary", value: "Probationary" }
				]
			},
			{ name: "nickname", label: "Preferred Name / Nickname" },
			{ name: "email", label: "Email Address *", type: "email" },
			{
				name: "gender",
				label: "Gender *",
				type: "select",
				options: [
					{ label: "--Select Gender--", value: "", disabled: true, selected: true },
					{ label: "Male", value: "Male" },
					{ label: "Female", value: "Female" }
				]
			},
			{ name: "contact", label: "Contact No. *" },
			{ name: "birthday", label: "Birthday *", type: "date" },
			{
				name: "marital_status",
				label: "Marital Status *",
				type: "select",
				options: [
					{ label: "--Select Marital Status--", value: "", disabled: true, selected: true },
					{ label: "Single", value: "Single" },
					{ label: "Married", value: "Married" }
				]
			},
			{ name: "address", label: "Full Address *", fullWidth: true },
		];

		if (formValues.employment_type === "Full-Time") {
			baseFields.push({
				section: "Required Information for Full-Time Employees",
				col: 3,
				fields: [
					{ name: "sss_number", label: "SSS No. *" },
					{ name: "pagibig", label: "PAG-IBIG No. *" },
					{ name: "philhealth", label: "PHILHEALTH No. *" },
				]
			});
		}

		if (formValues.employment_type === "Part-Time") {
			baseFields.push({
				section: "Contract Information for Part-Time Employees",
				col: 2,
				fields: [
					{ name: "start_of_contract", label: "Start of Contract *", type: "date" },
					{ name: "end_of_contract", label: "End of Contract *", type: "date" },
				]
			});
		}

		baseFields.push({
			section: "Emergency Contact Person",
			fields: [
				{ name: "emergency_name", label: "Full Name *" },
				{ name: "relationship", label: "Relationship *" },
				{ name: "emergency_address", label: "Address *" },
				{ name: "emergency_contact", label: "Contact No." },
				{ name: "city", label: "City *" },
				{ name: "postal_code", label: "Postal Code *" },
				{ name: "gcash_no", label: "Gcash No." },
			]
		});

		return baseFields;
	}, [formValues.employment_type]);

	if (!isOpen) return null;

	return (
		<ModalContainer title="Add Employee" width="3xl" variant="admin">
			<div className="mb-4 flex flex-col items-start w-full gap-2">
				<label className="block mb-1 font-medium">Import Excel:</label>
				<div className="flex flex-row items-center gap-2 w-full">
					<label
						htmlFor="excelUpload"
						className="cursor-pointer px-4 py-2 bg-white border border-gray-600 rounded-lg shadow hover:bg-gray-300 text-gray-700"
					>
						{excelFile ? "Change Excel File" : "Add Excel File"}
					</label>
					<input
						type="file"
						id="excelUpload"
						ref={excelInputRef}
						accept=".xls,.xlsx"
						className="hidden"
						onChange={handleExcelUpload}
					/>
					{excelFile && (
						<>
							<span className="text-sm text-gray-600">{excelFile.name}</span>
							<button
								onClick={handleClearExcel}
								className="px-3 py-1 bg-red-500 hover:bg-red-600 text-white rounded text-sm"
							>
								Clear Excel
							</button>
						</>
					)}
				</div>
			</div>

			{excelRows.length > 0 && (
				<div className="flex justify-between mb-4 items-center bg-blue-50 p-3 rounded">
					<button
						onClick={handleDeleteCurrent}
						className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg"
					>
						Delete This Entry
					</button>

					<div className="flex gap-2 items-center">
						<button
							onClick={() => {
								if (currentExcelIndex > 0) {
									const updatedRows = [...excelRows];
									updatedRows[currentExcelIndex] = formValues;
									setExcelRows(updatedRows);

									const prevIndex = currentExcelIndex - 1;
									setCurrentExcelIndex(prevIndex);
									setFormValues(mapExcelRowToForm(updatedRows[prevIndex]));
									setFieldErrors({});
								}
							}}
							className="px-3 py-1 bg-gray-200 hover:bg-gray-300 rounded disabled:opacity-50"
							disabled={currentExcelIndex === 0}
						>
							Prev
						</button>

						<span className="px-2 font-semibold">[{currentExcelIndex + 1} of {excelRows.length}]</span>

						<button
							onClick={() => {
								if (currentExcelIndex < excelRows.length - 1) {
									const updatedRows = [...excelRows];
									updatedRows[currentExcelIndex] = formValues;
									setExcelRows(updatedRows);

									const nextIndex = currentExcelIndex + 1;
									setCurrentExcelIndex(nextIndex);
									setFormValues(mapExcelRowToForm(updatedRows[nextIndex]));
									setFieldErrors({});
								}
							}}
							className="px-3 py-1 bg-gray-200 hover:bg-gray-300 rounded disabled:opacity-50"
							disabled={currentExcelIndex >= excelRows.length - 1}
						>
							Next
						</button>
					</div>
				</div>
			)}

			<Form
				fields={fields}
				formValues={formValues}
				onFieldChange={handleFieldChange}
				onSubmit={handleSubmit}
				disabled={isSubmitting}
				submitText={
					isSubmitting 
						? "Adding..." 
						: excelRows.length > 0 
							? currentExcelIndex < excelRows.length - 1 
								? "Save & Next" 
								: "Submit All Employees"
							: "Add Employee"
				}
				cancelText="Cancel"
				onCancel={handleClose}
				errorText={fieldErrors}
			/>

			<ConfirmModal
				isOpen={showConfirm}
				title="Confirm Submission"
				message={
					excelRows.length > 0 
						? `Are you sure you want to upload all ${excelRows.length} employees?` 
						: "Are you sure you want to add this employee?"
				}
				onConfirm={() => confirmAction && confirmAction()}
				onCancel={() => setShowConfirm(false)}
			/>

			<MessageModal
				isOpen={showMessage}
				title={messageType === "success" ? "Success" : messageType === "error" ? "Error" : "Warning"}
				message={messageText}
				onClose={() => {
					setShowMessage(false);
					if (messageType === "success") {
						handleClose();
					}
				}}
			/>
		</ModalContainer>
	);
}