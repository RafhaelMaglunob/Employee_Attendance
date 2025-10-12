import { Form } from "../form/Form";
import { useState } from 'react';
import { ModalContainer } from "../ui/modal";

export default function AddEmployeeModal({ isOpen, onClose, pushData }) {
    if (!isOpen) return null;

    const [isSubmitting, setIsSubmitting] = useState(false);
    const [formValues, setFormValues] = useState({});
    const [error, setError] = useState("");

    const fields = [
        { name: "fullname", label: "Full Name *" },
        { name: "employment_type", label: "Employment Type *", type: "select", options: ["Full-Time", "Part-Time"] },
        { name: "position", label: "Position *", type: "select", options: ["Crew", "HR"] },
        { name: "status", label: "Status *", type: "select", options: ["Employed", "Probationary"] },
        { name: "nickname", label: "Preferred Name / Nickname" },
        { name: "email", label: "Email Address *", type: "email" },
        { name: "gender", label: "Gender *", type: "select", options: ["Male", "Female"] },
        { name: "contact", label: "Contact No. *" },
        { name: "birthday", label: "Birthday *", type: "date" },
        { name: "marital_status", label: "Marital Status *", type: "select", options: ["Single", "Married"] },
        { name: "address", label: "Full Address *", fullWidth: true },
        {
            section: "Required Information for Full-Time Employees",
            col: 3,
            fields: [
                { name: "sss_no", label: "SSS No." },
                { name: "pagibig_no", label: "PAG-IBIG No." },
                { name: "philhealth_no", label: "PHILHEALTH No." },
            ],
        },
        {
            section: "Emergency Contact Person",
            fields: [
                { name: "emergency_name", label: "Full Name *" },
                { name: "relationship", label: "Relationship *" },
                { name: "emergency_address", label: "Address *" },
                { name: "emergency_contact", label: "Contact No." },
                { name: "city", label: "City *" },
                { name: "postal_code", label: "Postal Code *" },
                { name: "gcash_no", label: "Gcash No." },
            ],
        },
    ];

    const handleClose = async () => {
        setError("");
        onClose();
    }
    const handleSubmit = async (formData) => {
        if (isSubmitting) return;
        setIsSubmitting(true);
        setError("");

        try {
            const res = await fetch("http://localhost:3001/api/employees", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(formData),
            });

            const data = await res.json();

            if (!res.ok) {
                setError(data.message || data.error || "Failed to add employee");
                return;
            }

            pushData(data.employee || data);
            handleClose();

        } catch (err) {
            console.error("Failed to add employee:", err);
            setError("Failed to add employee");
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <ModalContainer title="Add Employee" width="3xl" variant="admin">
            <Form
                fields={fields}
                onSubmit={handleSubmit}
                submitText="Add Employee"
                cancelText="Cancel"
                onCancel={handleClose}
            />
            {error && <p className="text-red-700 mt-2 align-center">{error}</p>}
        </ModalContainer>
    );
}
