import React, { useState } from 'react';
import { Card } from '../ui/card';
import { Button } from '../ui/button';
import { Filter } from '../ui/filter';
import { ModalContainer } from '../ui/modal';

export default function DeleteEmployeeModal({ isOpen, onClose, employeeId, updateData }) {
    const [statusType, setStatusType] = useState("Termination");
    const [deletionDate, setDeletionDate] = useState("");
    const [loading, setLoading] = useState(false);
    const [errors, setErrors] = useState([]);

    if (!isOpen) return null;

    const handleDelete = async () => {
        const validationErrors = [];

        if (!deletionDate) validationErrors.push("Please select a deletion date.");

        if (validationErrors.length > 0) {
            setErrors(validationErrors);
            return;
        }

        setLoading(true);
        setErrors([]);

        try {
            // Determine status based on selected type
            const status = statusType === "Termination" ? "Termination" : "Resignation";

            const res = await fetch(`http://localhost:3001/api/employees/${employeeId}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ status, deletion_date: deletionDate })
            });

            const data = await res.json();

            if (!res.ok) {
                throw new Error(data.message || "Failed to update employee");
            }

            // Update local data
            updateData(prev =>
                prev.map(emp =>
                    emp.employee_id === employeeId
                        ? { ...emp, status, effective_deletion_date: deletionDate }
                        : emp
                )
            );

            onClose();
        } catch (err) {
            console.error("Failed to update employee:", err);
            setErrors([err.message || "Failed to update employee"]);
        } finally {
            setLoading(false);
        }
    };


    return (
        <ModalContainer 
            title={`Employee ${statusType}`} 
            titleSize="xl"
            variant="admin" 
            onClose={onClose}
        >
            <Card radius="none" className="bg-yellow-400 shadow-none">
                <div className="flex flex-col w-full relative space-y-4">
                    <label className="text-sm mb-1">Status Change Type</label>
                    <Filter className="flex flex-row text-black" noIcon={true} value={statusType}>
                        <Button onClick={() => setStatusType("Termination")} className="w-full text-left px-3 py-2 hover:bg-gray-200">Termination</Button>
                        <Button onClick={() => setStatusType("Resignation")} className="w-full text-left px-3 py-2 hover:bg-gray-200">Resignation</Button>
                    </Filter>

                    <label className="text-sm mb-1">Effective Deletion Date *</label>
                    <input 
                        type="date"
                        value={deletionDate}
                        onChange={(e) => setDeletionDate(e.target.value)}
                        className="block w-full bg-white border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />

                    {errors.length > 0 && (
                        <ul className="text-red-700 mt-1 list-disc list-inside">
                            {errors.map((err, idx) => (
                                <li key={idx}>{err}</li>
                            ))}
                        </ul>
                    )}
                </div>

                <div className="flex justify-end space-x-2 mt-4">
                    <Button onClick={onClose} className="px-4 py-2 bg-gray-300 rounded hover:bg-gray-400">Cancel</Button>
                    <Button 
                        onClick={handleDelete} 
                        className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
                        disabled={!deletionDate || loading}
                    >
                        {loading ? "Saving..." : `Confirm ${statusType}`}
                    </Button>
                </div>
            </Card>
        </ModalContainer>
    );
}
