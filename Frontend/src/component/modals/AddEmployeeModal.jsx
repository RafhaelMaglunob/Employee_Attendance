import { Form } from "../form/Form";
import { useState } from 'react';
import { ModalContainer } from "../ui/modal";

export default function AddEmployeeModal({ isOpen, onClose, pushData }) {
    if (!isOpen) return null;
    const [isSubmitting, setIsSubmitting] = useState(false);
    
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

    
    const handleSubmit = async (formData) => {
        if (isSubmitting) return; // ignore double-clicks
        setIsSubmitting(true);

        try {
            const res = await fetch("http://localhost:3001/api/employees", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(formData),
            });

            const savedEmployee = await res.json();
            pushData(savedEmployee);
            onClose();
        } catch (err) {
            console.error("Failed to add employee:", err);
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
                onCancel={onClose}
            />
        </ModalContainer>
    );
}
