import { Form } from "../form/Form";
import { ModalContainer } from "../ui/modal";
import { useState, useEffect } from "react";

export default function EditEmployeeModal({ isOpen, onClose, employeeId, updateData }) {
    const [employee, setEmployee] = useState(null);
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Fetch the single employee when modal opens
    useEffect(() => {
        if (!isOpen || !employeeId) return;

        let isMounted = true;
        fetch(`http://localhost:3001/api/employees/${employeeId}`)
            .then(res => res.json())
            .then(emp => { if (isMounted) setEmployee(emp); })
            .catch(err => console.error("Failed to fetch employee:", err));

        return () => { isMounted = false; };
    }, [isOpen, employeeId]);


    if (!isOpen) return null;
    if (!employee) return (
        <ModalContainer title="Edit Employee" width="3xl" variant="admin">
            <p>Loading employee data...</p>
        </ModalContainer>
    );

    const fields = [
        { name: "fullname", label: "Full Name *", defaultValue: employee.fullname },
        { name: "employment_type", label: "Employment Type *", type: "select", options: ["Full-Time", "Part-Time"], defaultValue: employee.employment_type },
        { name: "position", label: "Position *", type: "select", options: ["Crew", "HR"], defaultValue: employee.position },
        { name: "status", label: "Status *", type: "select", options: ["Employed", "Probationary"], defaultValue: employee.status },
        { name: "nickname", label: "Preferred Name / Nickname", defaultValue: employee.nickname },
        { name: "email", label: "Email Address *", type: "email", defaultValue: employee.email },
        { name: "gender", label: "Gender *", type: "select", options: ["Male", "Female"], defaultValue: employee.gender },
        { name: "contact", label: "Contact No. *", defaultValue: employee.contact },
        { name: "birthday", label: "Birthday *", type: "date", defaultValue: employee.birthday?.split("T")[0] },
        { name: "marital_status", label: "Marital Status *", type: "select", options: ["Single", "Married"], defaultValue: employee.marital_status },
        { name: "address", label: "Full Address *", fullWidth: true, defaultValue: employee.address },

        {
            section: "Required Information for Full-Time Employees",
            col: 3,
            fields: [
                { name: "sss_no", label: "SSS No.", defaultValue: employee.sss_number },
                { name: "pagibig_no", label: "PAG-IBIG No.", defaultValue: employee.pagibig },
                { name: "philhealth_no", label: "PHILHEALTH No.", defaultValue: employee.philhealth },
            ],
        },

        {
            section: "Emergency Contact Person",
            fields: [
                { name: "emergency_name", label: "Full Name *", defaultValue: employee.emergency_name },
                { name: "relationship", label: "Relationship *", defaultValue: employee.relationship },
                { name: "emergency_address", label: "Address *", defaultValue: employee.emergency_address },
                { name: "emergency_contact", label: "Contact No.", defaultValue: employee.emergency_contact },
                { name: "city", label: "City *", defaultValue: employee.city },
                { name: "postal_code", label: "Postal Code *", defaultValue: employee.postal_code },
                { name: "gcash_no", label: "Gcash No.", defaultValue: employee.gcash_no },
            ],
        },
    ];

    const handleSubmit = async (formData) => {
        if (isSubmitting) return;
        setIsSubmitting(true);

        try {
            const res = await fetch(`http://localhost:3001/api/employees/${employeeId}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(formData),
            });

            if (!res.ok) throw new Error("Update failed");

            const updated = await res.json();

            if (typeof updateData === "function") {
                updateData(updated); // ✅ only call if it’s a function
            } else {
                console.warn("updateData is not a function");
            }

            onClose();
        } catch (err) {
            console.error("Failed to update employee:", err);
        } finally {
            setIsSubmitting(false);
        }
    };


    return (
        <ModalContainer title="Edit Employee" width="3xl" variant="admin">
            <Form
                fields={fields}
                onSubmit={handleSubmit}
                submitText="Save Changes"
                cancelText="Cancel"
                onCancel={onClose}
            />
        </ModalContainer>
    );
}
