import {useState} from 'react'

export default function CalendarModal({ onClose }) {
  const today = new Date();
  const [currentDate, setCurrentDate] = useState(new Date());

  const monthName = currentDate.toLocaleString('en-US', { month: 'long' });
  const year = currentDate.getFullYear();

  const firstDay = new Date(year, currentDate.getMonth(), 1).getDay();
  const daysInMonth = new Date(year, currentDate.getMonth() + 1, 0).getDate();

  const prevMonth = () => setCurrentDate(new Date(year, currentDate.getMonth() - 1, 1));
  const nextMonth = () => setCurrentDate(new Date(year, currentDate.getMonth() + 1, 1));

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex justify-center items-center z-50">
      <div className="bg-white rounded-2xl shadow-xl p-5 w-[90%] max-w-[380px] animate-fadeIn">
        
        {/* Header */}
        <div className="flex justify-between items-center mb-3">
          <button onClick={prevMonth} className="text-gray-500 hover:text-black">←</button>
          <h2 className="text-lg font-semibold">{monthName} {year}</h2>
          <button onClick={nextMonth} className="text-gray-500 hover:text-black">→</button>
        </div>

        {/* Calendar Grid */}
        <div className="grid grid-cols-7 text-center text-gray-400 text-xs mb-2">
          <span>Sun</span><span>Mon</span><span>Tue</span><span>Wed</span><span>Thu</span><span>Fri</span><span>Sat</span>
        </div>

        <div className="grid grid-cols-7 gap-1 text-center text-sm">
          {[...Array(firstDay)].map((_, i) => <span key={i}></span>)}
          {[...Array(daysInMonth)].map((_, i) => {
            const day = i + 1;
            const isToday =
              day === today.getDate() &&
              currentDate.getMonth() === today.getMonth() &&
              currentDate.getFullYear() === today.getFullYear();

            return (
              <div
                key={i}
                className={`py-2 rounded-lg hover:bg-gray-200 cursor-pointer transition ${
                  isToday ? "bg-gray-800 text-white hover:bg-gray-900" : ""
                }`}
              >
                {day}
              </div>
            );
          })}
        </div>

        {/* Close Button */}
        <button
          onClick={onClose}
          className="mt-4 w-full bg-gray-800 text-white py-2 rounded-lg hover:bg-gray-900 transition"
        >
          Close
        </button>
      </div>
    </div>
  );
}