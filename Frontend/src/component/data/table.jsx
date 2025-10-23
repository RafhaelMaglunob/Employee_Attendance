import React, { useState, useMemo } from "react";
import { Button } from "../ui/button";

export function Table({ columns, data, className }) {
  return (
    <div className={`overflow-x-auto ${className || ""}`}>
      <table className="min-w-full bg-white border border-gray-200">
        <thead className="bg-gray-100">
          <tr>
            {columns.map((col) => (
              <th
                key={col.key}
                className={`text-left text-xs font-semibold text-gray-600 px-4 py-2 border-b ${col.headerClassName || ""}`}
              >
                {col.title}
              </th>
            ))}
          </tr>
        </thead>
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
              <tr
                key={rowIndex}
                className={rowIndex % 2 === 0 ? "bg-white" : "bg-gray-50 hover:bg-gray-100"}
              >
                {columns.map((col) => (
                  <td
                    key={col.key}
                    className="text-sm text-gray-700 px-4 py-2 border-b"
                  >
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

export function PaginatedTable({ columns, data, itemsPerPage = 5, className, readOnly = false }) {
  const [currentPage, setCurrentPage] = useState(1);
  const totalPages = Math.ceil(data.length / itemsPerPage);
  const isDataEmpty = !data || data.length === 0;

  const paginatedData = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return data.slice(start, start + itemsPerPage);
  }, [data, currentPage, itemsPerPage]);

  const getPageNumbers = () => {
    const pages = [];
    let start = Math.max(currentPage - 2, 1);
    let end = Math.min(start + 4, totalPages);
    start = Math.max(end - 4, 1);
    for (let i = start; i <= end; i++) pages.push(i);
    return pages;
  };

  const handlePageChange = (page) => {
    if (page >= 1 && page <= totalPages) setCurrentPage(page);
  };

  const isDisabled = isDataEmpty || readOnly; // all buttons disabled if readOnly or no data

  return (
    <div className={`overflow-x-auto ${className || ""}`}>
      <table className="min-w-full bg-white border border-gray-200">
        <thead className="bg-gray-100">
          <tr>
            {columns.map((col) => (
              <th
                key={col.key}
                className={`text-left text-xs font-semibold text-gray-600 px-4 py-2 border-b ${col.headerClassName || ""}`}
              >
                {col.title}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {paginatedData.length === 0 ? (
            <tr>
              <td
                colSpan={columns.length}
                className="text-center py-4 text-gray-500"
              >
                No data available
              </td>
            </tr>
          ) : (
            paginatedData.map((row, rowIndex) => (
              <tr
                key={rowIndex}
                className={rowIndex % 2 === 0 ? "bg-white" : "bg-gray-200 hover:bg-gray-100"}
              >
                {columns.map((col) => (
                  <td
                    key={col.key}
                    className="text-sm text-gray-700 px-4 py-2 border-b"
                  >
                    {col.render ? col.render(row) : row[col.key]}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>

      {/* Pagination */}
      <div className="flex justify-between items-center mt-4">
        <p className="text-xs">
          Showing {(currentPage - 1) * itemsPerPage + 1} to{" "}
          {Math.min(currentPage * itemsPerPage, data.length)} of {data.length} entries
        </p>
        <div className="flex space-x-1 items-center">
          <Button
            type="button"
            onClick={() => handlePageChange(currentPage - 1)}
            disabled={isDisabled || currentPage === 1}
            className="bg-black text-white px-4 py-1 rounded text-sm"
          >
            Previous
          </Button>

          {getPageNumbers().map((num) => (
            <Button
              type="button"
              key={num}
              onClick={() => handlePageChange(num)}
              disabled={isDisabled}
              className={`px-2 py-1 rounded text-sm ${
                currentPage === num ? "bg-black text-white" : "bg-black/60 text-white"
              }`}
            >
              {num}
            </Button>
          ))}

          <Button
            type="button"
            onClick={() => handlePageChange(currentPage + 1)}
            disabled={isDisabled || currentPage === totalPages}
            className="bg-black text-white px-4 py-1 rounded text-sm"
          >
            Next
          </Button>
        </div>
      </div>
    </div>
  );
}
