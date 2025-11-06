import React, { useState, useEffect } from 'react';
import { format, addDays, startOfWeek, addWeeks } from 'date-fns';
import { useFetchData } from './component/hooks/useFetchData';

const EmployeeSchedule = () => {
    const employeeId = localStorage.getItem("employeeId");

    const [weekStart, setWeekStart] = useState(startOfWeek(new Date(), { weekStartsOn: 1 }));

    const days = Array.from({ length: 7 }).map((_, i) => addDays(weekStart, i));
    const [availability, setAvailability] = useState({});

    const currentWeekStart = startOfWeek(new Date(), { weekStartsOn: 0 });
    const nextWeekStart = addWeeks(currentWeekStart, 1);
    const formattedNextWeek = format(nextWeekStart, "yyyy-MM-dd");

    useEffect(() => {
        const newDays = Array.from({ length: 7 }).map((_, i) => addDays(weekStart, i));
        setAvailability(
            newDays.reduce((acc, day) => {
                const key = format(day, 'yyyy-MM-dd');
                acc[key] = { available: false, times: [], showOptions: false };
                return acc;
            }, {})
        );
    }, [weekStart]);

    const { data: scheduleData = [] } = useFetchData(
        `http://192.168.1.9:3001/api/employee/schedule/${employeeId}`,
        (res) => res
    );

    useEffect(() => {
        if (!scheduleData || scheduleData.length === 0) return;

        setAvailability((prev) => {
            const updated = { ...prev };

            scheduleData.forEach((entry) => {
                const dateKey = entry.work_date;
                if (!updated[dateKey]) return;

                const startHour = parseInt(entry.start_time.split(":")[0], 10);

                if (startHour >= 7 && startHour <= 13) {
                    updated[dateKey].times = [...new Set([...updated[dateKey].times, "Opening"])];
                }

                if (startHour >= 15 && startHour <= 20) {
                    updated[dateKey].times = [...new Set([...updated[dateKey].times, "Closing"])];
                }

                updated[dateKey].available = updated[dateKey].times.length > 0;
            });

            return updated;
        });
    }, [scheduleData]);

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
                    fetch('http://192.168.1.9:3001/api/employee/availability', {
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
            <div className="flex justify-center md:h-20 md:text-3xl items-center bg-[#FFC629] text-black shadow-[12px_12px_0_#111827] font-bold py-2 px-4 mb-6 gap-8">
                <button onClick={prevWeek} className="text-xl font-bold">&lt;</button>
                <div>{weekRange}</div>
                <button onClick={nextWeek} className="text-xl font-bold">&gt;</button>
            </div>

            {days.map((day) => {
                const dateStr = format(day, 'yyyy-MM-dd');
                const dayNameShort = format(day, 'EEE');
                const dayNum = format(day, 'd');
                const isInCurrentWeek = dateStr <= formattedNextWeek;

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
                                    <div className={`text-xs md:text-sm ${
                                        isInCurrentWeek
                                            ? 'text-gray-500'
                                            : availability[dateStr]?.available
                                                ? 'text-green-600'
                                                : 'text-red-600'
                                    }`}>
                                        {isInCurrentWeek ? 'Completed' : availability[dateStr]?.available ? 'Scheduled' : 'Not Scheduled'}
                                    </div>
                                </div>
                            </div>

                            <button
                                className="bg-black text-sm text-white md:px-10 md:py-4 px-4 py-2 rounded-lg mr-4 shadow"
                                onClick={() => !isInCurrentWeek && toggleButton(dateStr)}
                                disabled={isInCurrentWeek}
                            >
                                {availability[dateStr]?.available ? 'Mark Unavailable' : 'Mark Available'}
                            </button>
                        </div>

                        {availability[dateStr]?.showOptions && (
                            <div className="flex justify-end">
                                <div className="flex justify-between gap-4 mt-2 bg-[#FFC629] px-4 py-4 shadow-[12px_12px_0_#111827]" style={{ width: '70%' }}>
                                    <button
                                        className={`px-4 py-2 text-white rounded w-full ${availability[dateStr]?.times.includes('Opening') ? 'bg-[#5E451D]' : 'bg-[#C39346]'}`}
                                        onClick={() => !isInCurrentWeek && toggleTime(dateStr, 'Opening')}
                                    >
                                        Opening
                                    </button>
                                    <button
                                        className={`px-4 py-3 text-white rounded w-full ${availability[dateStr]?.times.includes('Closing') ? 'bg-[#5E451D]' : 'bg-[#C39346]'}`}
                                        onClick={() => !isInCurrentWeek && toggleTime(dateStr, 'Closing')}
                                    >
                                        Closing
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                );
            })}
            
            <div className="flex justify-end">
                <button onClick={handleSave} className="md:w-full w-fit bg-black text-white text-lg px-20 py-5 rounded-lg shadow mt-4">
                    Save
                </button>
            </div>
        </div>
    );
};

export default EmployeeSchedule;
