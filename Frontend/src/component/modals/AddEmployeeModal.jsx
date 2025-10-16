import { Form } from "../form/Form";
import { useState, useMemo } from 'react';
import { ModalContainer } from "../ui/modal";

export default function AddEmployeeModal({ isOpen, onClose, pushData }) {
    if (!isOpen) return null;

    const [isSubmitting, setIsSubmitting] = useState(false);
    const [formValues, setFormValues] = useState({});
    const [error, setError] = useState("");

    const handleFieldChange = (name, value) => {
        setFormValues(prev => ({ ...prev, [name]: value }));
    };

    const fields = useMemo(() => [    
        { name: "fullname", label: "Full Name *" },
        { 
            name: "employment_type", 
            label: "Employment Type *", 
            type: "select", 
            options: [
                { label: "--Select Employment Type--", value: "", disabled: true, selected: true },
                { label: "Full-Time", value: "Full-Time" },
                { label: "Part-Time", value: "Part-Time" }
            ], 
            onChange: handleFieldChange
        },
        { 
            name: "position", 
            label: "Position *", 
            type: "select", 
            options: [
                { label: "--Select Position--", value: "", disabled: true, selected: true },
                { label: "Crew", value: "Crew" }, 
                { label: "HR", value: "HR" }
            ] 
        },
        { 
            name: "status", 
            label: "Status *", 
            type: "select", 
            options: [
                {label: "--Select Status--", value: "", disabled: true, selected: true}, 
                {label: "Employed", value: "Employed"}, 
                {label: "Probationary", value: "Probationary"}
            ] 
        },
        { name: "nickname", label: "Preferred Name / Nickname" },
        { name: "email", label: "Email Address *", type: "email" },
        { 
            name: "gender", 
            label: "Gender *", 
            type: "select", 
            options: [
                {label: "--Select Gender--", value: "", disabled: true, selected: true}, 
                {label: "Male", value: "Male"}, 
                {label: "Female", value: "Female"}
            ] 
        },
        { name: "contact", label: "Contact No. *" },
        { name: "birthday", label: "Birthday *", type: "date" },
        { 
            name: "marital_status", 
            label: "Marital Status *", 
            type: "select", 
            options: [
                
                {label: "--Select Marital Status--", value: "", disabled: true, selected: true}, 
                {label: "Single", value: "Single"}, 
                {label: "Married", value: "Married"}
            ]
        },
        { name: "address", label: "Full Address *", fullWidth: true },
        ...(formValues.employment_type === "Full-Time" ? [{
            section: "Required Information for Full-Time Employees",
            col: 3,
            fields: [
                { name: "sss_no", label: "SSS No." },
                { name: "pagibig_no", label: "PAG-IBIG No." },
                { name: "philhealth_no", label: "PHILHEALTH No." },
            ],
        }] : []),
        ...(formValues.employment_type === "Part-Time" ? [{
            section: "Required Information for Part-Time Employees",
            col: 2,
            fields: [
                { name: "start_of_contract", label: "Start Of Contract *", type: "date" },  
                { name: "end_of_contract", label: "End of Contract *", type: "date" },            ],
        }] : []),
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
    ], [formValues.employment_type]);

    const handleClose = () => {
        setError();
        setFormValues({});
        onClose();
    };

    const handleSubmit = async (data) => {
        if (isSubmitting) return;
        setIsSubmitting(true);
        setError();

        try {
            const res = await fetch("http://localhost:3001/api/employees", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(data),
            });

            const result = await res.json();

            if (!res.ok) {
                // If backend sends array of errors
                if (result.errors && Array.isArray(result.errors)) {
                    setError(result.errors);
                } else {
                    setError(result.message || "Failed to add employee");
                }
                setIsSubmitting(false);
                return;
            }

            pushData(result.employee || result);
            handleClose();
        } catch (err) {
            console.error(err);
            setError(err.message || "Failed to add employee");
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <ModalContainer title="Add Employee" width="3xl" variant="admin">
            <Form
                fields={fields}
                onSubmit={handleSubmit}
                submitText={isSubmitting ? "Adding..." : "Add Employee"}
                cancelText="Cancel"
                onCancel={handleClose}
                errorText={error}
                formValues={formValues}
                onFieldChange={handleFieldChange}
                submitDisabled={isSubmitting} 
            />

        </ModalContainer>
    );
}
