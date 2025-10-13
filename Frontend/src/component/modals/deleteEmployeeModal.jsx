import React, { useState } from 'react';
import { Card } from '../ui/card';
import { Button } from '../ui/button';
import { Filter } from '../ui/filter';
import { ModalContainer } from '../ui/modal';

export default function DeleteEmployeeModal({ isOpen, onClose, employeeId, updateData, api }) {
    const [statusType, setStatusType] = useState("Termination");
    const [deletionDate, setDeletionDate] = useState(""); // Track selected date

    if (!isOpen) return null;

    const handleDelete = async () => {
        if (!deletionDate) {
            alert("Please select a deletion date."); // simple alert for now
            return;
        }

        try {
            const res = await fetch(
                `http://localhost:3001/api/${api}/${employeeId}?status=${statusType}&deletionDate=${deletionDate}`, 
                { method: "DELETE" }
            ); 
            
            if (!res.ok) throw new Error("Delete failed");
            
            await res.json();
            updateData(prev => prev.filter(emp => emp.employee_id !== employeeId));
            onClose();
        } catch (err) {
            console.error("Failed to delete employee:", err);
        }
    };

    return (
        <ModalContainer 
            title={`Employee ${statusType}`} 
            titleSize="xl"
            variant="admin" 
            onClose={onClose}
        >
            <Card className="bg-yellow-400 border-none">
                <div className="flex flex-col w-full relative space-y-4">
                    <label className="text-sm mb-1">Status Change Type</label>
                    <Filter className="flex flex-row text-black" noIcon={true} value={statusType}>
                        <Button 
                            onClick={() => setStatusType("Termination")}
                            className="w-full text-left px-3 py-2 hover:bg-gray-200">
                            Termination
                        </Button>
                        <Button 
                            onClick={() => setStatusType("Resignation")}
                            className="w-full text-left px-3 py-2 hover:bg-gray-200"
                        >
                            Resignation
                        </Button>
                    </Filter>

                    <label className="text-sm mb-1">Date *</label>
                    <input 
                        id="deletionDate"
                        type="date"
                        value={deletionDate}
                        onChange={(e) => setDeletionDate(e.target.value)}
                        className="
                            block w-full bg-white border border-gray-300 rounded-lg px-3 py-2
                            text-sm sm:text-base
                            focus:outline-none focus:ring-2 focus:ring-blue-500
                            overflow-hidden
                        "
                    />
                </div>
                <div className="flex justify-end space-x-2 mt-4">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 bg-gray-300 rounded hover:bg-gray-400"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleDelete}
                        className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
                        disabled={!deletionDate}
                    >
                        Confirm {statusType}
                    </button>
                </div>
            </Card>
        </ModalContainer>
    );
}
