import { Form } from "../form/Form";
import { useState, useMemo } from "react";
import { ModalContainer } from "../ui/modal";

export default function AddEmployeeModal({ isOpen, onClose, pushData }) {
    if (!isOpen) return null;

    const [isSubmitting, setIsSubmitting] = useState(false);
    const [formValues, setFormValues] = useState({});
    const [error, setError] = useState("");
    const [fieldErrors, setFieldErrors] = useState({});

    const phoneRegex = /^(09|\+639)\d{9}$/;
    const emailRegex = /^[a-zA-Z0-9._%+-]+@(gmail|yahoo|outlook|hotmail)\.(com|ph|net)$/i;
    const postalRegex = /^\d+$/;

    // ✅ Auto-formatting and live validation
    const handleFieldChange = (name, value) => {
        let formattedValue = value;

        // 📱 Format Philippine phone numbers
        if (["contact", "emergency_contact", "gcash_no"].includes(name)) {
            let digits = value.replace(/\D/g, "");
            if (digits.startsWith("0")) digits = "63" + digits.slice(1);
            if (!digits.startsWith("63")) digits = "63" + digits;
            digits = digits.slice(0, 12); // +63 + 9 digits

            const local = digits.slice(2);
            const part1 = local.slice(0, 3);
            const part2 = local.slice(3, 6);
            const part3 = local.slice(6, 10);

            formattedValue = "+63";
            if (part1) formattedValue += " " + part1;
            if (part2) formattedValue += " " + part2;
            if (part3) formattedValue += " " + part3;
        }

        // 🪪 Format SSS No.
        else if (name === "sss_no") {
            const digits = value.replace(/\D/g, "").slice(0, 10);
            if (digits.length <= 2) formattedValue = digits;
            else if (digits.length <= 9)
                formattedValue = `${digits.slice(0, 2)}-${digits.slice(2)}`;
            else
                formattedValue = `${digits.slice(0, 2)}-${digits.slice(2, 9)}-${digits.slice(9)}`;
        }

        // 🏠 Format PAG-IBIG No.
        else if (name === "pagibig_no") {
            const digits = value.replace(/\D/g, "").slice(0, 12);
            formattedValue = digits.replace(/(\d{4})(?=\d)/g, "$1-");
        }

        // 🏥 Format PHILHEALTH No.
        else if (name === "philhealth_no") {
            const digits = value.replace(/\D/g, "").slice(0, 12);
            if (digits.length <= 2) formattedValue = digits;
            else if (digits.length <= 11)
                formattedValue = `${digits.slice(0, 2)}-${digits.slice(2)}`;
            else
                formattedValue = `${digits.slice(0, 2)}-${digits.slice(2, 11)}-${digits.slice(11)}`;
        }

        // Update field
        setFormValues((prev) => ({ ...prev, [name]: formattedValue }));

        // Validate live
        const newError = validateSingleField(name, formattedValue, {
            ...formValues,
            [name]: formattedValue,
        });

        setFieldErrors((prev) => ({
            ...prev,
            [name]: newError,
        }));
    };

    // ✅ Single-field validation (live)
    const validateSingleField = (name, value, allValues) => {
        const today = new Date();
        const birthdate = new Date(allValues.birthday);

        switch (name) {
        case "email":
            if (!value) return "Email is required.";
            if (!emailRegex.test(value))
            return "Must be Gmail, Yahoo, Outlook, or Hotmail (.com/.ph/.net)";
            break;

        case "contact":
            if (!value) return "Contact is required.";
            if (!phoneRegex.test(value.replace(/\s/g, "")))
            return "Must start with 09 or +639 and have 11 digits.";
            break;

        case "emergency_contact":
        case "gcash_no":
            if (value && !phoneRegex.test(value.replace(/\s/g, "")))
            return "Must start with 09 or +639 and have 11 digits.";
            break;

        case "postal_code":
            if (value && !postalRegex.test(value))
            return "Postal code must contain only numbers.";
            break;

        case "birthday":
            if (!value) return "Birthday is required.";
            
            const birthdateObj = new Date(value);
            if (birthdateObj > today) return "Birthday cannot be in the future.";

            const age = today.getFullYear() - birthdateObj.getFullYear();
            const monthDiff = today.getMonth() - birthdateObj.getMonth();
            const dayDiff = today.getDate() - birthdateObj.getDate();
            const adjustedAge = monthDiff < 0 || (monthDiff === 0 && dayDiff < 0) ? age - 1 : age;

            if (adjustedAge < 15) return "Employee must be at least 15 years old to work.";
            break;

        case "start_of_contract":
        case "end_of_contract":
            if (allValues.employment_type === "Part-Time") {
                if (!value)
                    return `${
                    name === "start_of_contract" ? "Start" : "End"
                    } of contract is required.`;
                if (
                    allValues.start_of_contract &&
                    allValues.end_of_contract &&
                    new Date(allValues.end_of_contract) <
                    new Date(allValues.start_of_contract)
                ) {
                    return "End of contract cannot be before start of contract.";
                }
            }
            break;

        default:
            return "";
        }
        return "";
    };

    // ✅ Full validation before submit
    const validateInput = (data) => {
        const errors = [];
        const birthdate = new Date(data.birthday);
        const today = new Date();

        if (!emailRegex.test(data.email))
            errors.push(
                "Invalid email. Must be Gmail, Yahoo, Outlook, or Hotmail with .com/.ph/.net"
            );

        const checkPhone = (num) => phoneRegex.test(num.replace(/\s/g, ""));

        if (!checkPhone(data.contact))
            errors.push("Contact number must start with 09 or +639 and be 11 digits.");

        if (data.emergency_contact && !checkPhone(data.emergency_contact))
            errors.push("Emergency contact must start with 09 or +639 and be 11 digits.");

        if (data.gcash_no && !checkPhone(data.gcash_no))
            errors.push("GCash number must start with 09 or +639 and be 11 digits.");

        if (data.postal_code && !postalRegex.test(data.postal_code))
            errors.push("Postal code must contain only numbers.");

        if (!data.birthday) errors.push("Birthday is required.");
        else if (birthdate > today)
            errors.push("Birthday cannot be in the future.");
        else {
            const age = today.getFullYear() - birthdate.getFullYear();
            const monthDiff = today.getMonth() - birthdate.getMonth();
            const dayDiff = today.getDate() - birthdate.getDate();
            const adjustedAge = monthDiff < 0 || (monthDiff === 0 && dayDiff < 0) ? age - 1 : age;

            if (adjustedAge < 16) {
                errors.push("Employee must be at least 16 years old to work.");
            }
        }


        if (data.employment_type === "Full-Time") {
            if (!data.sss_no)
                errors.push("SSS No. is required for Full-Time employees.");
            else if (!/^\d{10}$/.test(data.sss_no.replace(/\D/g, "")))
                errors.push("SSS No. must be 10 digits long.");

            if (!data.pagibig_no)
                errors.push("PAG-IBIG No. is required for Full-Time employees.");
            else if (!/^\d{12}$/.test(data.pagibig_no.replace(/\D/g, "")))
                errors.push("PAG-IBIG No. must be 12 digits long.");

            if (!data.philhealth_no)
                errors.push("PHILHEALTH No. is required for Full-Time employees.");
            else if (!/^\d{12}$/.test(data.philhealth_no.replace(/\D/g, "")))
                errors.push("PHILHEALTH No. must be 12 digits long.");
        }

        if (data.employment_type === "Part-Time") {
            if (!data.start_of_contract)
                errors.push("Start of contract is required.");
            if (!data.end_of_contract)
                errors.push("End of contract is required.");
            if (
                new Date(data.end_of_contract) < new Date(data.start_of_contract)
            )
                errors.push("End of contract cannot be before start of contract.");
        }

        return errors;
    };

    const fields = useMemo(
        () => [
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
                onChange: handleFieldChange,
            },
            {
                name: "position",
                label: "Position *",
                type: "select",
                options: [
                    { label: "--Select Position--", value: "", disabled: true, selected: true },
                    { label: "Crew", value: "Crew" },
                    { label: "HR", value: "HR" },
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
            { name: "contact", label: "Contact No. *", placeholder: "XXX XXX XXXX" },
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
            ...(formValues.employment_type === "Full-Time"
                ? [
                    {
                        section: "Required Information for Full-Time Employees",
                        col: 3,
                        fields: [
                            { name: "sss_no", label: "SSS No." },
                            { name: "pagibig_no", label: "PAG-IBIG No." },
                            { name: "philhealth_no", label: "PHILHEALTH No." },
                        ],
                    },
                ]
                : []),
            ...(formValues.employment_type === "Part-Time"
                ? [
                    {
                        section: "Required Information for Part-Time Employees",
                        col: 2,
                        fields: [
                            { name: "start_of_contract", label: "Start Of Contract *", type: "date" },
                            { name: "end_of_contract", label: "End of Contract *", type: "date" },
                        ],
                    },
                ]
                : []),
            {
                section: "Emergency Contact Person",
                fields: [
                    { name: "emergency_name", label: "Full Name *" },
                    { name: "relationship", label: "Relationship *" },
                    { name: "emergency_address", label: "Address *" },
                    { name: "emergency_contact", label: "Contact No.", placeholder: "XXX XXX XXXX" },
                    { name: "city", label: "City *" },
                    { name: "postal_code", label: "Postal Code *" },
                    { name: "gcash_no", label: "GCash No.", placeholder: "XXX XXX XXXX" },
                ],
            },
        ],
        [formValues.employment_type]
    );

    const handleClose = () => {
        setError();
        setFormValues({});
        setFieldErrors({});
        onClose();
    };

    const handleSubmit = async (data) => {
        if (isSubmitting) return;
        setIsSubmitting(true);
        setError();

        const validationErrors = validateInput(data);

        if (validationErrors.length > 0) {
            setError(validationErrors);
            setIsSubmitting(false);
            return;
        }

        try {
            const res = await fetch("http://localhost:3001/api/employees", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(data),
            });

            const result = await res.json();

            if (!res.ok) {
                if (result.errors && Array.isArray(result.errors)) {
                    setError(result.errors);
                } else {
                    setError(result.message || "Failed to add employee");
                }
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
                fieldErrors={fieldErrors}
                formValues={formValues}
                phoneField={["gcash_no", "emergency_contact", "contact"]}
                onFieldChange={handleFieldChange}
                submitDisabled={isSubmitting}
                errorText={error} // ✅ show validation & backend errors
            />
        </ModalContainer>
    );

}
