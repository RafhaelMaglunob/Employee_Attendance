// Table.jsx
import React from "react";

export function Table({ columns, data, className }) {
  return (
    <div className={`overflow-x-auto ${className || ""}`}>
      <table className="min-w-full bg-white border border-gray-200">
        {/* Table Header */}
        <thead className="bg-gray-100">
          <tr>
            {columns.map((col) => (
              <th
                key={col.key}
                className="text-left text-xs font-semibold text-gray-600 px-4 py-2 border-b"
              >
                {col.title}
              </th>
            ))}
          </tr>
        </thead>

        {/* Table Body */}
        <tbody>
          {data.length === 0 ? (
            <tr>
              <td
                colSpan={columns.length}
                className="text-center py-4 text-gray-500"
              >
                No data available
              </td>
            </tr>
          ) : (
            data.map((row, rowIndex) => (
              <tr key={rowIndex} className="hover:bg-gray-50">
                {columns.map((col) => (
                  <td
                    key={col.key}
                    className="text-sm text-gray-700 px-4 py-2 border-b"
                  >
                    {/* ✅ Render function support */}
                    {col.render ? col.render(row) : row[col.key]}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
