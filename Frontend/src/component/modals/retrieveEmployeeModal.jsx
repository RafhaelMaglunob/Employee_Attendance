import { Table } from "../data/table";
import { Form } from "../form/Form";
import { ModalContainer } from "../ui/modal";
import { useState, useEffect } from "react";
import { useFetchData } from "../hooks/useFetchData";

export default function RetrieveEmployeeModal({ isOpen, onClose, employeeId, updateData, api }) {
    const [employee, setEmployee] = useState(null);
    const [error, setError] = useState("");
    const [isSubmitting, setIsSubmitting] = useState(false);

    const transformContract = (emp) => ({
        start_of_contract: emp.start_of_contract,
        end_of_contract: emp.end_of_contract
    })

    const { data: empContract } = useFetchData(
        `http://localhost:3001/api/${api}/contract/${employeeId}`,
        transformContract
    )
    // Fetch employee + contracts + dependents + documents
    useEffect(() => {
        if (!isOpen || !employeeId) return;

        let isMounted = true;
        setEmployee(null);
        setError("");

        fetch(`http://localhost:3001/api/${api}/${employeeId}`)
            .then(res => res.json())
            .then(emp => { if (isMounted) setEmployee(emp); })
            .catch(err => console.error("Failed to fetch employee:", err));

        return () => { isMounted = false; };
    }, [isOpen, employeeId, api]);

    if (!isOpen) return null;

    if (!employee) return (
        <ModalContainer title="View Employee" width="3xl" variant="admin">
            <p>Loading employee data...</p>
        </ModalContainer>
    );

    const formatDate = (iso) => iso ? new Date(iso).toISOString().split("T")[0] : "-";

    // Employee form fields
    const fields = [
        { name: "fullname", label: "Full Name *", defaultValue: employee.fullname || "-", disabled: true },
        { name: "employment_type", label: "Employment Type *", defaultValue: employee.employment_type || "-", disabled: true },
        { name: "position", label: "Position *", defaultValue: employee.position || "-", disabled: true },
        { name: "status", label: "Status *", defaultValue: employee.status || "-", disabled: true },
        { name: "nickname", label: "Preferred Name / Nickname", defaultValue: employee.nickname || "-", disabled: true },
        { name: "email", label: "Email Address *", defaultValue: employee.email || "-", disabled: true },
        { name: "gender", label: "Gender *", defaultValue: employee.gender || "-", disabled: true },
        { name: "contact", label: "Contact No. *", defaultValue: employee.contact || "-", disabled: true },
        { name: "birthday", label: "Birthday *", defaultValue: formatDate(employee.birthday), disabled: true },
        { name: "marital_status", label: "Marital Status *", defaultValue: employee.marital_status || "-", disabled: true },
        { name: "address", label: "Full Address *", defaultValue: employee.address || "-", fullWidth: true, disabled: true },
        { name: "sss_no", label: "SSS No.", defaultValue: employee.sss_number || "-", disabled: true },
        { name: "pagibig_no", label: "PAG-IBIG No.", defaultValue: employee.pagibig || "-", disabled: true },
        { name: "philhealth_no", label: "PHILHEALTH No.", defaultValue: employee.philhealth || "-", disabled: true },
        { name: "emergency_name", label: "Emergency Contact Name", defaultValue: employee.emergency_name || "-", disabled: true },
        { name: "relationship", label: "Relationship", defaultValue: employee.relationship || "-", disabled: true },
        { name: "emergency_address", label: "Emergency Address", defaultValue: employee.emergency_address || "-", disabled: true },
        { name: "emergency_contact", label: "Emergency Contact No.", defaultValue: employee.emergency_contact || "-", disabled: true },
        { name: "city", label: "City", defaultValue: employee.city || "-", disabled: true },
        { name: "postal_code", label: "Postal Code", defaultValue: employee.postal_code || "-", disabled: true },
        { name: "gcash_no", label: "Gcash No.", defaultValue: employee.gcash_no || "-", disabled: true },
    ];
    const contractFields = [
        { key: "start_of_contract", title: "Start of Contract *" },
        { key: "end_of_contract", title: "End of Contract *" },
    ]

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

    return (
        <ModalContainer title="Retrieve Employee" width="3xl" variant="admin">
            <Form
                fields={fields}
                onSubmit={handleRetrieve}
                submitText="Retrieve"
                cancelText="Close"
                errorText={error}
                contract={
                    <Table columns={contractFields} data={empContract}></Table>
                }
                onCancel={() => onClose()}
            />
        </ModalContainer>
    );
}
