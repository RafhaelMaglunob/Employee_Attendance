import { Table } from "../data/table";
import { Form } from "../form/Form";
import { ModalContainer } from "../ui/modal";
import { useState, useEffect } from "react";

const columns = ["Start of Contract", "End of Contract"]

export default function RetrieveEmployeeModal({ isOpen, onClose, employeeId, updateData, api }) {
    const [employee, setEmployee] = useState(null);
    const [error, setError] = useState("");
    const [readOnly, setReadOnly] = useState(true);
    const [isSubmitting, setIsSubmitting] = useState(false)

    // Fetch employee
    useEffect(() => {
        if (!isOpen || !employeeId) return;

        // Reset state for new employee
        setEmployee(null);
        setReadOnly(true);

        let isMounted = true;

        fetch(`http://localhost:3001/api/${api}/${employeeId}`)
            .then(res => res.json())
            .then(emp => {
                if (isMounted) setEmployee(emp);
            })
            .catch(err => console.error("Failed to fetch employee:", err));

        return () => { isMounted = false; };
    }, [isOpen, employeeId]);

    if (!isOpen) return null;

    if (!employee) return (
        <ModalContainer title="View Employee" width="3xl" variant="admin">
            <p>Loading employee data...</p>
        </ModalContainer>
    );
    const formatDate = (isoString) => {
        if (!isoString) return "-";
        const date = new Date(isoString);
        // Get year, month, day in local time
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, "0"); // Months are 0-indexed
        const day = String(date.getDate()).padStart(2, "0");
        return `${year}-${month}-${day}`;
    };

    const fields = [
        { name: "fullname", label: "Full Name *", defaultValue: employee.fullname || "-", disabled: readOnly },
        { name: "employment_type", label: "Employment Type *", type: "select", options: ["Full-Time", "Part-Time"], defaultValue: employee.employment_type || "-", disabled: readOnly },
        { name: "position", label: "Position *", type: "select", options: ["Crew", "Head Staff"], defaultValue: employee.position || "-", disabled: readOnly },
        { name: "status", label: "Status *", type: "select", options: ["Employed", "Probationary"], defaultValue: employee.status || "-", disabled: readOnly },
        { name: "nickname", label: "Preferred Name / Nickname", defaultValue: employee.nickname || "-", disabled: readOnly },
        { name: "email", label: "Email Address *", type: "email", defaultValue: employee.email || "-", disabled: readOnly },
        { name: "gender", label: "Gender *", type: "select", options: ["Male", "Female"], defaultValue: employee.gender || "-", disabled: readOnly },
        { name: "contact", label: "Contact No. *", defaultValue: employee.contact || "-", disabled: readOnly },
        { name: "birthday", label: "Birthday *", type: "date", defaultValue: employee.birthday ? formatDate(employee.birthday).split("T")[0] : "-", disabled: readOnly },
        { name: "marital_status", label: "Marital Status *", type: "select", options: ["Single", "Married"], defaultValue: employee.marital_status || "-", disabled: readOnly },
        { name: "address", label: "Full Address *", fullWidth: true, defaultValue: employee.address || "-", disabled: readOnly },
        {
            section: "Required Information for Full-Time Employees",
            col: 3,
            fields: [
                { name: "sss_no", label: "SSS No.", defaultValue: employee.sss_number || "-", disabled: readOnly },
                { name: "pagibig_no", label: "PAG-IBIG No.", defaultValue: employee.pagibig || "-", disabled: readOnly },
                { name: "philhealth_no", label: "PHILHEALTH No.", defaultValue: employee.philhealth || "-", disabled: readOnly },
            ],
        },
        {
            section: "Emergency Contact Person",
            fields: [
                { name: "emergency_name", label: "Full Name *", defaultValue: employee.emergency_name || "-", disabled: readOnly },
                { name: "relationship", label: "Relationship *", defaultValue: employee.relationship || "-", disabled: readOnly },
                { name: "emergency_address", label: "Address *", defaultValue: employee.emergency_address || "-", disabled: readOnly },
                { name: "emergency_contact", label: "Contact No.", defaultValue: employee.emergency_contact || "-", disabled: readOnly },
                { name: "city", label: "City *", defaultValue: employee.city || "-", disabled: readOnly },
                { name: "postal_code", label: "Postal Code *", defaultValue: employee.postal_code || "-", disabled: readOnly },
                { name: "gcash_no", label: "Gcash No.", defaultValue: employee.gcash_no || "-", disabled: readOnly },
            ],
        },
    ];

    const handleRetrieve = async () => {
        if (isSubmitting) return;
        setIsSubmitting(true);
        try {
            const res = await fetch(`http://localhost:3001/api/${api}/${employeeId}?status=Employed`,{ 
                method: "DELETE",
            }); 
            if (!res.ok) throw new Error("Delete failed");
            await res.json();
            updateData(prev => prev.filter(emp => emp.employee_id !== employeeId));
            onClose();
        } catch (err) {
            console.error("Failed to delete employee:", err);
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleClose = async () => {
        setError("")
        onClose()
    }

    return (
        <ModalContainer title={readOnly ? "View Employee" : "Retrieve Employee"} width="3xl" variant="admin">
            <Form
                fields={fields}
                onSubmit={handleRetrieve}
                submitText={"Retrieve"}
                cancelText={"Close"}
                errorText={error}
                onCancel={handleClose}
            />
            <Table columns={columns}></Table>
        </ModalContainer>
    );
}
