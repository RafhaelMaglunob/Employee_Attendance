import { useState, useMemo } from "react";
import { ModalContainer } from "../ui/modal";
import { Form } from "../form/Form";
import { Button } from "../ui/button";

export default function AddEmployeeModal({ isOpen, onClose, updateData }) {
    const [formValues, setFormValues] = useState({});
    const [fieldErrors, setFieldErrors] = useState({});
    const [isSubmitting, setIsSubmitting] = useState(false);

    // ✅ Validation logic
    const validateSingleField = (name, value, allValues) => {
        const phoneRegex = /^(09|\+639)\d{9}$/;
        const emailRegex = /^[a-zA-Z0-9._%+-]+@(gmail|yahoo|outlook|hotmail)\.(com|ph|net)$/i;
        const postalRegex = /^\d+$/;
        const today = new Date();

        switch (name) {
            case "fullname":
                if (!value.trim()) return "Full name is required";
                break;

            case "email":
                if (!value) return "Email is required";
                if (!emailRegex.test(value)) return "Invalid email format";
                break;

            case "contact":
                if (!value) return "Contact number is required";
                if (!phoneRegex.test(value.replace(/\s/g, ""))) return "Invalid contact number";
                break;

            case "emergency_contact":
            case "gcash_no":
                if (value && !phoneRegex.test(value.replace(/\s/g, ""))) return "Invalid phone number";
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

            case "sss_no":
            case "pagibig_no":
            case "philhealth_no":
                if (allValues.employment_type === "Full-Time" && !value)
                    return `${name.replace("_", " ").toUpperCase()} is required`;
                break;

            case "start_of_contract":
            case "end_of_contract":
                if (allValues.employment_type === "Part-Time" && !value)
                    return `${name.replaceAll("_", " ")} is required`;
                break;

            default:
                return "";
        }

        // ✅ Validate date order for contract
        if (name === "end_of_contract" && allValues.start_of_contract && value) {
            const start = new Date(allValues.start_of_contract);
            const end = new Date(value);
            if (end < start) return "End date cannot be before start date";
        }

        return "";
    };

    // ✅ Live field change + formatting
    const handleFieldChange = (name, value) => {
        let formatted = value;

        if (["contact", "emergency_contact", "gcash_no"].includes(name)) {
            let digits = value.replace(/\D/g, "");
            if (digits.startsWith("0")) digits = "63" + digits.slice(1);
            if (!digits.startsWith("63")) digits = "63" + digits;
            digits = digits.slice(0, 12);
            const local = digits.slice(2);
            formatted = "+63";
            if (local.length >= 3) formatted += " " + local.slice(0, 3);
            if (local.length >= 6) formatted += " " + local.slice(3, 6);
            if (local.length >= 10) formatted += " " + local.slice(6, 10);
        }

        setFormValues((prev) => ({ ...prev, [name]: formatted }));

        const err = validateSingleField(name, formatted, { ...formValues, [name]: formatted });
        setFieldErrors((prev) => ({ ...prev, [name]: err }));
    };

    // ✅ Submit Handler
    const handleSubmit = async (data) => {
        const allErrors = {};
        Object.entries(formValues).forEach(([key, val]) => {
            const err = validateSingleField(key, val, formValues);
            if (err) allErrors[key] = err;
        });

        setFieldErrors(allErrors);
        if (Object.keys(allErrors).length > 0) return;

        setIsSubmitting(true);

        try {
            const res = await fetch("http://localhost:3001/api/employees", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(data),
            });

            const result = await res.json();

            // ⚠️ Handle field-specific backend errors (e.g., duplicate email)
            if (!res.ok) {
                if (result.field && result.error) {
                    setFieldErrors((prev) => ({ ...prev, [result.field]: result.error }));
                    return;
                }
                if (Array.isArray(result.errors)) {
                    const mapped = {};
                    result.errors.forEach((err) => {
                        if (err.field && err.error) {
                            mapped[err.field] = err.error;
                        }
                    });
                    setFieldErrors((prev) => ({ ...prev, ...mapped }));
                    return;
                }


                return;
            }

            // ✅ success
            if (typeof updateData === "function") updateData(result);
            handleClose();
        } catch (err) {
            console.error("Submission error:", err);
        } finally {
            setIsSubmitting(false);
        }

    };

    const handleClose = () => {
        setFormValues({});
        setFieldErrors({});
        onClose();
    };

    // ✅ Dynamic fields
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
                    { label: "Head Staff", value: "Head Staff" },
                ],
            },
            {
                name: "status",
                label: "Status *",
                type: "select",
                options: [
                    { label: "--Select Status--", value: "", disabled: true, selected: true },
                    { label: "Employed", value: "Employed" },
                    { label: "Probationary", value: "Probationary" },
                ],
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
                    { label: "Female", value: "Female" },
                ],
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
                    { label: "Married", value: "Married" },
                ],
            },
            { name: "address", label: "Full Address *", fullWidth: true },
        ];

        if (formValues.employment_type === "Full-Time") {
            baseFields.push({
                section: "Required Information for Full-Time Employees",
                col: 3,
                fields: [
                    { name: "sss_no", label: "SSS No. *" },
                    { name: "pagibig_no", label: "PAG-IBIG No. *" },
                    { name: "philhealth_no", label: "PHILHEALTH No. *" },
                ],
            });
        }

        if (formValues.employment_type === "Part-Time") {
            baseFields.push({
                section: "Contract Information for Part-Time Employees",
                col: 2,
                fields: [
                    { name: "start_of_contract", label: "Start of Contract *", type: "date" },
                    { name: "end_of_contract", label: "End of Contract *", type: "date" },
                ],
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
            ],
        });

        return baseFields;
    }, [formValues.employment_type]);


    if (!isOpen) return null;

    return (
        <ModalContainer title="Add Employee" width="3xl" variant="admin">
            <Form
                fields={fields}
                formValues={formValues}
                onFieldChange={handleFieldChange}
                onSubmit={handleSubmit}
                submitText={isSubmitting ? "Adding..." : "Add Employee"}
                cancelText="Cancel"
                onCancel={handleClose}
                errorText={fieldErrors}
            />

        </ModalContainer>
    );
}
