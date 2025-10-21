import { Form } from "../form/Form";
import { ModalContainer } from "../ui/modal";
import { useState, useEffect } from "react";
import { useFetchData } from "../hooks/useFetchData";
import { Table } from "../data/table";

export default function ViewEmployeeModal({ isOpen, onClose, employeeId, updateData, api }) {
	const [employee, setEmployee] = useState(null);
	const [formValues, setFormValues] = useState({});
	const [error, setError] = useState("");
	const [readOnly, setReadOnly] = useState(true);
	const [isSubmitting, setIsSubmitting] = useState(false);

	// Fetch archived contracts
	const { data: empContract } = useFetchData(
		employeeId ? `http://localhost:3001/api/${api}/contract/${employeeId}` : null,
		(emp) => {
			// ensure it is always an array
			if (!emp) return [];
			return Array.isArray(emp)
				? emp.map(c => ({
						start_of_contract: c.start_of_contract,
						end_of_contract: c.end_of_contract
				  }))
				: [{ start_of_contract: emp.start_of_contract, end_of_contract: emp.end_of_contract }];
		}
	);

	// Fetch employee data
	useEffect(() => {
		if (!isOpen || !employeeId) return;

		setEmployee(null);
		setReadOnly(true);

		let isMounted = true;
		fetch(`http://localhost:3001/api/${api}/${employeeId}`)
			.then(res => res.json())
			.then(emp => {
				if (isMounted) setEmployee(emp);
			})
			.catch(err => console.error("Failed to fetch employee:", err));

		return () => {
			isMounted = false;
		};
	}, [isOpen, employeeId]);

	// Populate formValues when employee loads
	useEffect(() => {
		if (!employee) return;

		const formatDate = (iso) => {
			if (!iso) return "";
			const d = new Date(iso);
			const year = d.getFullYear();
			const month = String(d.getMonth() + 1).padStart(2, "0");
			const day = String(d.getDate()).padStart(2, "0");
			return `${year}-${month}-${day}`;
		};

		const values = {
			fullname: employee.fullname || "-",
			employment_type: employee.employment_type || "-",
			position: employee.position || "-",
			status: employee.status || "-",
			nickname: employee.nickname || "-",
			email: employee.email || "-",
			gender: employee.gender || "-",
			contact: employee.contact || "-",
			birthday: employee.birthday ? formatDate(employee.birthday) : "-",
			marital_status: employee.marital_status || "-",
			address: employee.address || "-",
			sss_no: employee.sss_number || "-",
			pagibig_no: employee.pagibig || "-",
			philhealth_no: employee.philhealth || "-",
			emergency_name: employee.emergency_name || "-",
			relationship: employee.relationship || "-",
			emergency_address: employee.emergency_address || "-",
			emergency_contact: employee.emergency_contact || "-",
			city: employee.city || "-",
			postal_code: employee.postal_code || "-",
			gcash_no: employee.gcash_no || "-",
		};

		setFormValues(values);
	}, [employee]);

	if (!isOpen) return null;

	if (!employee)
		return (
			<ModalContainer title="View Employee" width="3xl" variant="admin">
				<p>Loading employee data...</p>
			</ModalContainer>
		);

	const fields = [
		{ name: "fullname", label: "Full Name *", disabled: readOnly },
		{ name: "employment_type", label: "Employment Type *", type: "select", options: ["Full-Time", "Part-Time"], disabled: readOnly },
		{ name: "position", label: "Position *", type: "select", options: ["Crew", "Head Staff"], disabled: readOnly },
		{ name: "status", label: "Status *", type: "select", options: ["Employed", "Probationary"], disabled: readOnly },
		{ name: "nickname", label: "Preferred Name / Nickname", disabled: readOnly },
		{ name: "email", label: "Email Address *", type: "email", disabled: readOnly },
		{ name: "gender", label: "Gender *", type: "select", options: ["Male", "Female"], disabled: readOnly },
		{ name: "contact", label: "Contact No. *", disabled: readOnly },
		{ name: "birthday", label: "Birthday *", type: "date", disabled: readOnly },
		{ name: "marital_status", label: "Marital Status *", type: "select", options: ["Single", "Married"], disabled: readOnly },
		{ name: "address", label: "Full Address *", fullWidth: true, disabled: readOnly },
		{
			section: "Required Information for Full-Time Employees",
			col: 3,
			fields: [
				{ name: "sss_no", label: "SSS No.", disabled: readOnly },
				{ name: "pagibig_no", label: "PAG-IBIG No.", disabled: readOnly },
				{ name: "philhealth_no", label: "PHILHEALTH No.", disabled: readOnly },
			]
		},
		{
			section: "Emergency Contact Person",
			fields: [
				{ name: "emergency_name", label: "Full Name *", disabled: readOnly },
				{ name: "relationship", label: "Relationship *", disabled: readOnly },
				{ name: "emergency_address", label: "Address *", disabled: readOnly },
				{ name: "emergency_contact", label: "Contact No.", disabled: readOnly },
				{ name: "city", label: "City *", disabled: readOnly },
				{ name: "postal_code", label: "Postal Code *", disabled: readOnly },
				{ name: "gcash_no", label: "Gcash No.", disabled: readOnly },
			]
		}
	];

	const contractFields = [
		{ key: "start_of_contract", title: "Start of Contract *" },
		{ key: "end_of_contract", title: "End of Contract *" }
	];

	const handleRetrieve = async () => {
		if (isSubmitting) return;

		setIsSubmitting(true);
		setError("");

		try {
			const res = await fetch(`http://localhost:3001/api/${api}/${employeeId}`, {
				method: "PATCH",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ status: "Employed" })
			});

			if (!res.ok) throw new Error("Retrieve failed");

			const updatedEmployee = await res.json();
			updateData(prev => prev.map(emp => emp.employee_id === employeeId ? updatedEmployee : emp));
			onClose();
		} catch (err) {
			console.error("Failed to retrieve employee:", err);
			setError("Failed to retrieve employee. Check console for details.");
		} finally {
			setIsSubmitting(false);
		}
	};

	const handleClose = () => {
		setError("");
		onClose();
	};

	return (
		<ModalContainer title={"View Employee"} width="3xl" variant="admin">
			<Form
				fields={fields}
				formValues={formValues}
				onSubmit={handleRetrieve}
				submitText={"Retrieve"}
				cancelText={readOnly ? "Close" : "Cancel"}
				contracts={<Table columns={contractFields} data={empContract || []} />}
				errorText={Array.isArray(error) ? error : error ? error.split('.').map(s => s.trim()).filter(Boolean) : []}
				onCancel={() => readOnly ? handleClose() : setReadOnly(true)}
			/>
		</ModalContainer>
	);
}
