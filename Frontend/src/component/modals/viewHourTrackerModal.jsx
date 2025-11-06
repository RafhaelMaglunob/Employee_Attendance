import { Form } from "../form/Form";
import { ModalContainer } from "../ui/modal";
import { useState, useEffect } from "react";
import { Button } from "../ui/button";

export default function ViewHourTrackerModal({ isOpen, onClose, hoursTrackerId, hourTrackerPeriod, updateData }) {
    const [hoursTracker, setHoursTracker] = useState(null);
    // Fetch hoursTracker
    useEffect(() => {
        if (!isOpen || !hoursTrackerId || !hourTrackerPeriod) return;

        setHoursTracker(null);

        let isMounted = true;

        fetch(`http://192.168.1.9:3001/api/work-logs/${hoursTrackerId}?pay_period=${hourTrackerPeriod}`)
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
