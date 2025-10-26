import React, { useState } from 'react';
import { format, addDays, startOfWeek, addWeeks } from 'date-fns';

const EmployeeSchedule = () => {
    const employeeId = localStorage.getItem("employeeId");
	const [weekStart, setWeekStart] = useState(startOfWeek(new Date(), { weekStartsOn: 0 }));
	const days = Array.from({ length: 7 }).map((_, i) => addDays(weekStart, i));

	const [availability, setAvailability] = useState(
		days.reduce((acc, day) => {
			acc[format(day, 'yyyy-MM-dd')] = { available: false, times: [] }; // times: ["Opening","Closing"]
			return acc;
		}, {})
	);

	const toggleButton = (date) => {
		setAvailability((prev) => ({
			...prev,
			[date]: { ...prev[date], showOptions: !prev[date].showOptions },
		}));
	};

	const toggleTime = (date, time) => {
		setAvailability((prev) => {
			const times = prev[date].times.includes(time)
				? prev[date].times.filter((t) => t !== time)
				: [...prev[date].times, time];

			return {
				...prev,
				[date]: {
					...prev[date],
					times,
					available: times.length > 0,
				},
			};
		});
	};

	const weekRange = `${format(days[0], 'MMM d')} - ${format(days[6], 'MMM d, yyyy')}`;
	const prevWeek = () => setWeekStart(addWeeks(weekStart, -1));
	const nextWeek = () => setWeekStart(addWeeks(weekStart, 1));

    const handleSave = async () => {
        try {
            // Collect all availability that are marked as available
            const payload = Object.entries(availability)
            .filter(([_, data]) => data.available)
            .map(([date, data]) => ({
                employee_id: employeeId,
                date,
                times: data.times
            }));

            if (payload.length === 0) {
                alert('No availability selected!');
                return;
            }

            await Promise.all(
                payload.map(item =>
                    fetch('http://localhost:3001/api/employee/availability', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(item),
                    })
                )
            );

            alert('Saved successfully!');
        } catch (err) {
            console.error(err);
            alert('Failed to save. Please try again.');
        }
    };


	return (
		<div className="p-4 max-w-md md:max-w-full mx-auto font-inter">
			{/* Header */}
			<div className="flex justify-center md:h-20 md:text-3xl items-center bg-[#FFC629] text-black shadow-[12px_12px_0_#111827] font-bold py-2 px-4 mb-6 gap-8">
				<button onClick={prevWeek} className="text-xl font-bold">&lt;</button>
				<div>{weekRange}</div>
				<button onClick={nextWeek} className="text-xl font-bold">&gt;</button>
			</div>

			{/* Day Cards */}
			{days.map((day) => {
				const dateStr = format(day, 'yyyy-MM-dd');
				const dayNameShort = format(day, 'EEE');
				const dayNum = format(day, 'd');

				return (
					<div key={dateStr} className="mb-8">
						<div className="flex justify-between md:w-full items-center bg-[#FFC629] shadow-[12px_12px_0_#111827]">
							<div className="flex items-center gap-2">
								<div className="bg-red-600 text-white text-center md:py-4 md:px-10 px-7 py-2">
									<div className="text-sm md:text-lg">{dayNameShort}</div>
									<div className="font-bold md:text-3xl text-lg">{dayNum}</div>
								</div>
								<div>
									<div className="text-sm md:text-xl">{format(day, 'MMM')} {dayNum}</div>
									<div className={`text-xs md:text-sm ${availability[dateStr].available ? 'text-green-600' : 'text-red-600'}`}>
										{availability[dateStr].available ? 'Available' : 'Not Available'}
									</div>
								</div>
							</div>

							<button
								className="bg-black text-sm text-white md:px-10 md:py-4 px-4 py-2 rounded-lg mr-4 shadow"
								onClick={() => toggleButton(dateStr)}
							>
								{availability[dateStr].available ? 'Mark Unavailable' : 'Mark Available'}
							</button>
						</div>

						{/* Time Selection Container */}
                        {availability[dateStr].showOptions && (
                            <div className="flex justify-end">
                                <div className="flex justify-between gap-4 mt-2 bg-[#FFC629] px-4    py-4  shadow-[12px_12px_0_#111827]" style={{ width: '70%' }}>
                                    <button
                                        className={`px-4 py-2 text-white rounded w-full ${availability[dateStr].times.includes('Opening') ? 'bg-[#5E451D]' : 'bg-[#C39346]'}`}
                                        onClick={() => toggleTime(dateStr, 'Opening')}
                                    >
                                        Opening
                                    </button>
                                    <button
                                        className={`px-4 py-3 text-white rounded w-full ${availability[dateStr].times.includes('Closing') ? 'bg-[#5E451D]' : 'bg-[#C39346]'}`}
                                        onClick={() => toggleTime(dateStr, 'Closing')}
                                    >
                                        Closing
                                    </button>
                                </div>
                            </div>
                        )}
					</div>
				);
			})}
            <div className="flex justify-end    ">
			    <button onClick={handleSave} className="md:w-full w-fit bg-black text-white px-20 py-5 rounded shadow mt-4">Save</button>
            </div>
        </div>
	);
};

export default EmployeeSchedule;
