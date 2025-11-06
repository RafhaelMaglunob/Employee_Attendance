import { Form } from "../form/Form";
import { ModalContainer } from "../ui/modal";
import { useState, useEffect, useMemo } from "react";
import { useFetchData } from "../hooks/useFetchData";
import { PaginatedTable } from "../data/table";
import { Button } from "../ui/button";

export default function ViewEmployeeModal({ isOpen, onClose, employeeId, updateData, api }) {
    const [employee, setEmployee] = useState(null);
    const [formValues, setFormValues] = useState({});
    const [initialFormValues, setInitialFormValues] = useState({});
    const [fieldErrors, setFieldErrors] = useState({});
    const [readOnly, setReadOnly] = useState(true);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isRenewalOpen, setIsRenewalOpen] = useState(false);

    // ✅ Transform contract data
    const transformContract = (emp) => ({
        start_of_contract: emp.start_of_contract,
        end_of_contract: emp.end_of_contract,
    });

    const { data: empContract, loading: contractLoading } = useFetchData(
        `http://192.168.1.9:3001/api/employees/contract/${employeeId}`,
        transformContract
    );

    // ✅ Fetch employee data
    useEffect(() => {
        if (!isOpen || !employeeId) return;

        setEmployee(null);
        setReadOnly(true);
        setFieldErrors({});

        let isMounted = true;

        fetch(`http://192.168.1.9:3001/api/${api}/${employeeId}`)
            .then((res) => {
                if (!res.ok) throw new Error(`HTTP ${res.status}`);
                return res.json();
            })
            .then((emp) => {
                if (isMounted) setEmployee(emp);
            })
            .catch((err) => {
                console.error(err);
                if (isMounted) setEmployee(null);
            });

        return () => {
            isMounted = false;
        };
    }, [isOpen, employeeId, api]);

    // ✅ Populate form values
    useEffect(() => {
        if (!employee) return;

        const formatDate = (iso) => {
            if (!iso) return "";
            const d = new Date(iso);
            return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
        };

        const values = {
            fullname: employee.fullname || "",
            employment_type: employee.employment_type || "",
            position: employee.position || "",
            status: employee.status || "",
            nickname: employee.nickname || "",
            email: employee.email || "",
            gender: employee.gender || "",
            contact: employee.contact || "",
            birthday: employee.birthday ? formatDate(employee.birthday) : "",
            marital_status: employee.marital_status || "",
            address: employee.address || "",
            sss_no: employee.sss_number || "",
            pagibig_no: employee.pagibig || "",
            philhealth_no: employee.philhealth || "",
            emergency_name: employee.emergency_name || "",
            relationship: employee.relationship || "",
            emergency_address: employee.emergency_address || "",
            emergency_contact: employee.emergency_contact || "",
            city: employee.city || "",
            postal_code: employee.postal_code || "",
            gcash_no: employee.gcash_no || "",
            start_of_contract: employee.start_of_contract || "",
            end_of_contract: employee.end_of_contract || "",
            contract_type: "",
            contract_date: "",
            currentContractEndDate: employee.end_of_contract || "",
        };

        setFormValues(values);
        setInitialFormValues(values);
    }, [employee]);

    // ✅ Get latest contract (highest end_of_contract date)
    const latestContract = useMemo(() => {
        if (!Array.isArray(empContract) || empContract.length === 0) return null;
        return empContract.reduce((latest, current) => {
            const latestDate = new Date(latest.end_of_contract);
            const currentDate = new Date(current.end_of_contract);
            return currentDate > latestDate ? current : latest;
        });
    }, [empContract]);

    // ✅ Validation Logic (with latest contract check)
    const validateSingleField = (name, value, allValues) => {
        const today = new Date();
        const phoneRegex = /^(09|\+639)\d{9}$/;
        const emailRegex = /^[a-zA-Z0-9._%+-]+@(gmail|yahoo|outlook|hotmail)\.(com|ph|net)$/i;
        const postalRegex = /^\d+$/;

        switch (name) {
            case "email":
                if (!value) return "Email is required";
                if (!emailRegex.test(value)) return "Invalid email format";
                break;

            case "contact":
                if (!value) return "Contact required";
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
                if (!value) return "Birthday required";
                const bdate = new Date(value);
                if (bdate > today) return "Birthday cannot be in the future";
                const age = today.getFullYear() - bdate.getFullYear();
                if (age < 15) return "Employee must be at least 15 years old";
                break;

            case "contract_date": {
                if (!value) return "Contract date is required";
                if (!latestContract) return "";

                const parsedDate = new Date(value);
                const latestEnd = new Date(latestContract.end_of_contract);
                const type = allValues.contract_type;

                if (isNaN(parsedDate.getTime())) return "Invalid contract date";

                // ✅ Amendment Rule
                if (type === "Amendment" && parsedDate > latestEnd)
                    return "Amendment date cannot be later than the latest contract end date";

                // ✅ Renewal Rule
                if (type === "Renewal" && parsedDate < latestEnd)
                    return "Renewal date cannot be earlier than the latest contract end date";
                break;
            }

            default:
                return "";
        }
        return "";
    };

    // ✅ Live field change + validation
    const handleFieldChange = (name, value) => {
        let formattedValue = value;

        // phone normalization
        if (["contact", "emergency_contact", "gcash_no"].includes(name)) {
            let digits = value.replace(/\D/g, "");
            if (digits.startsWith("0")) digits = "63" + digits.slice(1);
            if (!digits.startsWith("63")) digits = "63" + digits;
            digits = digits.slice(0, 12);
            const local = digits.slice(2);
            formattedValue = "+63";
            if (local.length >= 3) formattedValue += " " + local.slice(0, 3);
            if (local.length >= 6) formattedValue += " " + local.slice(3, 6);
            if (local.length >= 10) formattedValue += " " + local.slice(6, 10);
        }

        // ID formats
        if (name === "sss_no") {
            const digits = value.replace(/\D/g, "").slice(0, 10);
            if (digits.length <= 2) formattedValue = digits;
            else if (digits.length <= 9) formattedValue = `${digits.slice(0, 2)}-${digits.slice(2)}`;
            else formattedValue = `${digits.slice(0, 2)}-${digits.slice(2, 9)}-${digits.slice(9)}`;
        }

        if (name === "pagibig_no") {
            const digits = value.replace(/\D/g, "").slice(0, 12);
            formattedValue = digits.replace(/(\d{4})(?=\d)/g, "$1-");
        }

        if (name === "philhealth_no") {
            const digits = value.replace(/\D/g, "").slice(0, 12);
            if (digits.length <= 2) formattedValue = digits;
            else if (digits.length <= 11) formattedValue = `${digits.slice(0, 2)}-${digits.slice(2)}`;
            else formattedValue = `${digits.slice(0, 2)}-${digits.slice(2, 11)}-${digits.slice(11)}`;
        }

        setFormValues((prev) => ({ ...prev, [name]: formattedValue }));

        const newError = validateSingleField(name, formattedValue, { ...formValues, [name]: formattedValue });
        setFieldErrors((prev) => ({ ...prev, [name]: newError }));
    };

    // ✅ Submit Handler
    const handleSubmit = async () => {
        if (readOnly) {
            setReadOnly(false);
            return;
        }

        if (isSubmitting) return;
        setIsSubmitting(true);
        setFieldErrors({});

        const allErrors = {};

        // Validate all visible/required fields
        Object.keys(formValues).forEach((field) => {
            const isContractField = ["contract_type", "contract_date", "start_of_contract", "end_of_contract"].includes(field);

            // Only validate contract fields if renewal form is open
            if (!isRenewalOpen && isContractField) return;

            const error = validateSingleField(field, formValues[field], formValues);
            if (error) allErrors[field] = error;
        });

        setFieldErrors(allErrors);

        // If any errors exist, stop submission
        if (Object.keys(allErrors).length > 0) {
            setIsSubmitting(false);
            return;
        }

        // Prepare payload
        const payload = { ...formValues };
        if (!isRenewalOpen) {
            delete payload.contract_type;
            delete payload.contract_date;
        }

        try {
            const res = await fetch(`http://192.168.1.9:3001/api/${api}/${employeeId}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
            });

            const updated = await res.json();

            if (!res.ok) {
                // Handle multiple field-specific errors from backend
                if (updated.errors && Array.isArray(updated.errors)) {
                    const newErrors = {};
                    updated.errors.forEach(e => {
                        newErrors[e.field] = e.error;
                    });
                    setFieldErrors(newErrors);
                } else if (updated.field && updated.message) {
                    setFieldErrors({ [updated.field]: updated.message });
                }
                setIsSubmitting(false);
                return;
            }

            // Update state with returned employee data
            setInitialFormValues(updated.employee);
            setEmployee(updated.employee);
            setFormValues(updated.employee);
            setReadOnly(true);
            if (typeof updateData === "function") updateData(updated.employee);

        } catch (err) {
            console.error(err);
        } finally {
            setIsSubmitting(false);
        }
    };



    const handleClose = () => {
        setFieldErrors({});
        onClose();
    };

    // ✅ Dynamic Form Fields (untouched)
    const fields = useMemo(() => [
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
        ...(formValues.employment_type === "Part-Time" && !readOnly && isRenewalOpen
            ? [
                {
                    section: "Renewal/Amendment of Contract for Part-Time Employees",
                    col: 2,
                    fields: [
                        {
                            name: "contract_type",
                            label: "Contract Type *",
                            type: "select",
                            options: [
                                { label: "--Select Contract Type--", value: "", disabled: true, selected: true },
                                { label: "Amendment", value: "Amendment" },
                                { label: "Renewal", value: "Renewal" },
                            ],
                            disabled: readOnly,
                        },
                        {
                            name: "contract_date",
                            label: "Contract Date *",
                            type: "date",
                            disabled: readOnly,
                        },
                    ],
                },
            ]
            : []),
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
            ],
        },
    ], [readOnly, isRenewalOpen, formValues.employment_type]);

    const contractFields = useMemo(() => [
        { key: "no", title: "No." },
        { key: "start_of_contract", title: "Start of Contract *" },
        { key: "end_of_contract", title: "End of Contract *" },
    ], []);

    const numberedContracts = (empContract || []).map((item, index) => ({
        ...item,
        no: index + 1,
    }));



    if (!isOpen) return null;

    return (
        <ModalContainer title={readOnly ? "View Employee" : "Edit Employee"} width="3xl" variant="admin">
            {!employee ? (
                <p>Loading employee data...</p>
            ) : (
                <Form
                    fields={fields}
                    formValues={formValues}
                    errorText={fieldErrors}
                    onFieldChange={handleFieldChange}
                    onSubmit={handleSubmit}
                    submitText={readOnly ? "Edit" : "Save Changes"}
                    cancelText={readOnly ? "Close" : "Cancel"}
                    contracts={
                        <div className="flex flex-col w-full space-y-3 items-center">
                            <PaginatedTable className="w-full" columns={contractFields} data={numberedContracts} itemsPerPage={5} readOnly={readOnly} />
                            {!readOnly && formValues.employment_type?.toLowerCase() === "part-time" && (
                                <Button
                                    type="button"
                                    onClick={() => {
                                        if (isRenewalOpen) {
                                            // 🧹 If closing, clear renewal-specific fields
                                            setFormValues(prev => ({
                                                ...prev,
                                                contract_type: "",
                                                contract_date: ""
                                            }));
                                        }
                                        setIsRenewalOpen(!isRenewalOpen);
                                    }}

                                    className={`${
                                        !isRenewalOpen ? "bg-green-500 border-green-700" : "bg-red-500 border-red-700"
                                    } text-sm border w-fit rounded-lg px-3 py-1 text-white`}
                                >
                                    {!isRenewalOpen ? "New Contract" : "Close Contract"}
                                </Button>
                            )}
                        </div>
                    }
                    onCancel={() => {
                        if (readOnly) {
                            handleClose();
                        } else {
                            setFormValues(initialFormValues);
                            setFieldErrors({});
                            setReadOnly(true);
                        }
                    }}
                />
            )}

            {contractLoading && <p className="text-gray-400 mt-2">Loading contracts...</p>}
        </ModalContainer>
    );
}
