import { Form } from "../form/Form";
import { ModalContainer } from "../ui/modal";
import { useState, useEffect } from "react";
import { Button } from "../ui/button";

export default function ViewHourTrackerModal({ isOpen, onClose, hoursTrackerId, hourTrackerPeriod, updateData }) {
    const [hoursTracker, setHoursTracker] = useState(null);
    const [error, setError] = useState("");
    const [readOnly, setReadOnly] = useState(true);
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Fetch hoursTracker
    useEffect(() => {
        if (!isOpen || !hoursTrackerId || !hourTrackerPeriod) return;

        setHoursTracker(null);
        setReadOnly(true);

        let isMounted = true;

        fetch(`http://localhost:3001/api/work-logs/${hoursTrackerId}?pay_period=${hourTrackerPeriod}`)
            .then(res => {
                if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
                return res.json();
            })
            .then(data => {
                if (isMounted) setHoursTracker({
                    employee_id: data.employee_id,
                    name: data.employee_name,
                    pay_period: data.pay_period,
                    days_worked: data.days_worked,
                    hours_worked: data.total_hours
                });
            })
            .catch(err => {
                console.error("Failed to fetch Work Log reports:", err);
                setError("Failed to load work log");  // optional: show error in modal
            });


        return () => { isMounted = false; };
    }, [isOpen, hoursTrackerId]);

    if (!isOpen) return null;

    if (!hoursTracker) return (
        <ModalContainer title="View Work Log" width="3xl" variant="admin">
            <p>Loading hour tracker data...</p>
        </ModalContainer>
    );

    const fields = [
        { name: "employee_name", label: "Employee Name", defaultValue: hoursTracker.name || "-", disabled: readOnly, fullWidth: true },
        { name: "pay_period", label: "Pay Period", defaultValue: hoursTracker.pay_period || "-", disabled: readOnly, fullWidth: true },
        {   
            section: " ",
            col: 2,
            fields: [
                { name: "days_worked", label: "Days Worked", defaultValue: hoursTracker.days_worked || "-", disabled: readOnly },
                { name: "hours_worked", label: "Hours Worked", defaultValue: hoursTracker.hours_worked || "-", disabled: readOnly },
            ],
        },
    ];

    const handleSubmit = async (formData) => {
        if (readOnly) {
            setReadOnly(false);
            return;
        }

        if (isSubmitting) return;
        setIsSubmitting(true);

        try {
            const res = await fetch(`http://localhost:3001/api/work-logs/${hoursTrackerId}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(formData),
            });

            const updated = await res.json();
            if (!res.ok) {
                setError(updated.message || updated.error || "Failed to update work log");
                return;
            }

            setHoursTracker(updated);
            if (typeof updateData === "function") updateData(updated);
            setReadOnly(true);
        } catch (err) {
            console.error(err);
            setError("Failed to update work log");
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleClose = () => {
        setError("");
        onClose();
    };

    return (
        <ModalContainer width="lg" variant="admin" className="p-4">
            <h1 className="text-xl font-semibold font-inter mb-4">View Hours Record</h1>
            <div className="flex flex-col space-y-5 font-[400] text-left">
                <div>
                    <label className="text-md">Employee Name</label>
                    <span className="block px-3 py-2 border rounded-lg bg-white font-semibold">
                        {hoursTracker.name || "-"}
                    </span>
                </div>

                <div>
                    <label className="text-md">Pay Period</label>
                    <span className="block px-3 py-2 border rounded-lg bg-white font-semibold">
                            {hoursTracker.pay_period || "-"}
                    </span>
                </div>

                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="text-md">Days Worked</label>
                        <span className="block px-3 py-2 border rounded-lg bg-white font-semibold">
                            {hoursTracker.days_worked || "-"}
                        </span>
                    </div>

                    <div>
                        <label className="text-md">Hours Worked</label>
                        <span className="block px-3 py-2 border rounded-lg bg-white font-semibold">
                            {hoursTracker.hours_worked || "-"}
                        </span>
                    </div>
                </div>
            </div>
            <div className="w-full flex justify-end">
                <Button
                    onClick={onClose}
                    className="bg-white px-4 py-2 rounded-lg border mt-10"
                >
                    Close
                </Button>
            </div>
        </ModalContainer>

    );
}
