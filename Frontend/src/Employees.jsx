import React from 'react';
import { useState, useEffect, useMemo } from 'react';
import { Search } from './component/ui/search';
import { applySearchAndFilter } from './component/utils/applySearchFilter';
import { Table } from './component/data/table'; 
import { Card } from './component/ui/card';
import { Button } from './component/ui/button';
import { Filter } from './component/ui/filter';
import { useFetchData } from './component/hooks/useFetchData';

import AddEmployeeModal from './component/modals/AddEmployeeModal';
import ViewEmployeeModal from './component/modals/viewEmployeeModal';
import DeleteEmployeeModal from './component/modals/deleteEmployeeModal';
import RetrieveEmployeeModal from './component/modals/retrieveEmployeeModal';

const tabList = ["Employed", "Archive"];

const getActionButtons = (row, activeTab, handleView, handleDocuments, handleDelete, handleRetrieve) => {
    if (activeTab === "employed") {
        return [
            {
                img: "../img/Edit_Icon.png",
                alt: "View Icon",
                onClick: () => handleView(row)
            },
            {
                img: "../img/Reports_Icon.png",
                alt: "Report Icon",
                onClick: () => handleDocuments(row)
            },
            {
                img: "../img/Delete_Icon.png",
                alt: "Delete Icon",
                onClick: () => handleDelete(row)
            }
        ];
    } else if (activeTab === "archive") {
        return [
            {
                img: "../img/Edit_Icon.png",
                alt: "View Icon",
                onClick: () => handleRetrieve(row)
            }
        ];
    }
    return [];
};

function Employees() {
    const savedTab = (localStorage.getItem("employeeTab") || "employed").toLowerCase();
    const savedPage = parseInt(localStorage.getItem("employeePage") || "1", 10);
    const savedSort = (localStorage.getItem("employeeSort") || "Filter");

    const itemsPerPage = 5; 
    const [query, setQuery] = useState("");
    const [activeTab, setActiveTab] = useState(savedTab);
    const [currentPage, setCurrentPage] = useState(savedPage);
    const [api, setApi] = useState(activeTab.toLowerCase() === "employed" ? "employees" : "archive");
    const [selectedSort, setSelectedSort] = useState(savedSort);
    const [selectedId, setSelectedId] = useState(null);
    const [isAddOpen, setIsAddOpen] = useState(false);
    const [isViewOpen, setIsViewOpen] = useState(false);
    const [isDeleteOpen, setIsDeleteOpen] = useState(false);
    const [isRetrieveOpen, setIsRetrieveOpen] = useState(false);
    
    useEffect(() => {
        localStorage.setItem("employeeSort", selectedSort)
    }, [selectedSort])

    useEffect(() => {
        localStorage.setItem("employeeTab", activeTab)
    }, [activeTab])

    const handlePageChange = (page) => {
        setCurrentPage(page);
        localStorage.setItem("employeePage", page);
    };

    const handleView = (row) => {
        setSelectedId(row.employee_id);
        setIsViewOpen(true);
    };

    const handleRetrieve = (row) => {
        setSelectedId(row.employee_id);
        setIsRetrieveOpen(true);
    };

    const handleDocuments = (row) => {
        // Implement if needed
    };

    const handleDelete = async (row) => {
        setSelectedId(row.employee_id);
        setIsDeleteOpen(true);
    };

    const transformEmployee = (emp) => ({
        employee_id: emp.employee_id,
        name: emp.fullname,
        position: emp.position,
        type: emp.employment_type,
        status: emp.status,
        documents_complete: emp.documents_complete
    });

    const { data, loading, pushData, updateData } = useFetchData(
        `http://localhost:3001/api/${api}`,
        transformEmployee
    );

    const columns = [
        { key: "employee_id", title: "Employee ID" },
        { key: "name", title: "Name" },
        { key: "position", title: "Position" },
        { key: "type", title: "Type" },
        {
            key: "status",
            title: "Status",
            render: (row) => (
                <span
                    className={`px-4 py-1 rounded-[40px] text-[10px] border ${
                        activeTab === "archive"
                            ? "bg-[#FEE2E2] border-[#991B1B]"
                            : row.status === "Employed"
                                ? "bg-[#DCFCE7] border-[#166534]"
                                : "bg-[#FEF9C3] border-[#854D0E]"
                    }`}
                >
                    {row.status}
                </span>
            )
        },
        {
            key: "documents",
            title: "Documents",
            render: (row) => (
                <span
                    className={`px-4 py-1 rounded-[40px] text-[10px] border ${
                        row.documents_complete
                            ? "bg-[#DCFCE7] border-[#166534]"
                            : "bg-[#FEF9C3] border-[#854D0E]"
                    }`}
                >
                    {row.documents_complete ? "Complete" : "Incomplete"}
                </span>
            )
        },
        {
            key: "actions",
            title: "Actions",
            render: (row) => {
                const buttons = getActionButtons(row, activeTab.toLowerCase(), handleView, handleDocuments, handleDelete, handleRetrieve);
                return (
                    <div className="flex gap-2">
                        {buttons.map((btn, idx) => (
                            <Button
                                key={idx}
                                onClick={btn.onClick}
                                className="rounded-[50px] hover:bg-black/20 w-10 h-10"
                            >
                                <img src={btn.img} alt={btn.alt} />
                            </Button>
                        ))}
                    </div>
                );
            }
        }
    ];

    const filteredData = useMemo(() => {
        return applySearchAndFilter(
            data, 
            query,
            ["employee_id", "name", "position", "type", "status"],
            "",
            ""
        );
    }, [data, query]);

    const totalPages = Math.ceil(filteredData.length / itemsPerPage);

    const sortedData = useMemo(() => {
        if (!selectedSort) return filteredData;

        return [...filteredData].sort((a, b) => {
            const nameA = (a.employee_id || "").toUpperCase();
            const nameB = (b.employee_id || "").toUpperCase();

            if (nameA < nameB) return selectedSort === "ASC" ? -1 : 1;
            if (nameA > nameB) return selectedSort === "ASC" ? 1 : -1;
            return 0;
        });
    }, [filteredData, selectedSort]);

    const paginatedData = useMemo(() => {
        const startIndex = (currentPage - 1) * itemsPerPage;
        const endIndex = startIndex + itemsPerPage;
        return sortedData.slice(startIndex, endIndex);
    }, [sortedData, currentPage]);
    
    const getPageNumbers = (currentPage, totalPages, maxButtons = 5) => {
        const pages = [];

        if (totalPages <= maxButtons) {
            // show all pages if totalPages <= maxButtons
            for (let i = 1; i <= totalPages; i++) pages.push(i);
        } else {
            let start = Math.max(currentPage - Math.floor(maxButtons / 2), 1);
            let end = start + maxButtons - 1;

            if (end > totalPages) {
                end = totalPages;
                start = end - maxButtons + 1;
            }

            for (let i = start; i <= end; i++) pages.push(i);
        }

        return pages;
    };
    
    const pageNumbers = getPageNumbers(currentPage, totalPages, 5);
    
    useEffect(() => {
        if (!loading) { // only run after data is loaded
            const totalPages = Math.ceil(filteredData.length / itemsPerPage);
            if (currentPage > totalPages) {
                setCurrentPage(totalPages || 1);
            }
        }
    }, [filteredData, currentPage, itemsPerPage, loading]);

    const handleAddEmployee = () => setIsAddOpen(true);

    const headerContent = (
        <div className="flex items-center w-full gap-4">
            <div className="flex-1">
                <Search
                    value={query}
                    onChange={setQuery}
                    placeholder="Search employees..."
                />
            </div>
            <div className="w-[10%] flex-none">
                <Filter value={selectedSort} className="text-black">
                    <Button
                        className="w-full text-left px-3 py-2 hover:bg-gray-100"
                        onClick={() => { setSelectedSort("ASC"); }}
                    >
                        ASC
                    </Button>
                    <Button
                        className="w-full text-left px-3 py-2 hover:bg-gray-100"
                        onClick={() => { setSelectedSort("DESC"); }}
                    >
                        DESC
                    </Button>
                </Filter>
            </div>
        </div>
    );

    if (loading) return <p className="text-gray-400 text-xl">Loading</p>;

    return (
        <div className="pb-6">
            <div className="flex flex-row justify-between mr-3 mb-3 mt-3">
                <h1 className="font-bold text-2xl">Employee Records</h1>
                <Button 
                    onClick={handleAddEmployee}
                    className="bg-black text-white px-4 py-1 rounded-lg text-sm"
                >
                    + Add Employee
                </Button>
            </div>

            <Card header={headerContent} radius="none" variant="admin" width="full">
                <div className="flex flex-row space-x-7 font-inter text-xs border-b-1">
                    {tabList.map((tab, index) => (
                        <Button
                            key={index}
                            onClick={() => { 
                                const lowerTab = tab.toLowerCase();
                                setActiveTab(lowerTab);
                                localStorage.setItem("employeeTab", lowerTab);
                                setCurrentPage(1);
                                setApi(lowerTab === "employed" ? "employees" : "archive");
                             }}
                            className={`border-b-2 pb-2 ${activeTab === tab.toLowerCase() ? "border-current" : "border-transparent"}`}
                        >
                            {tab}
                        </Button>
                    ))}
                </div>

                <div className="mt-5">
                    <Table columns={columns} data={paginatedData} />

                    <div className="border-t mt-5 pt-2 flex flex-row justify-between items-center">
                        <p>
                            Showing {(currentPage - 1) * itemsPerPage + 1} to {Math.min(currentPage * itemsPerPage, filteredData.length)} of {filteredData.length} entries
                        </p>

                        <div className="flex flex-row space-x-1 items-center">
                            <Button 
                                onClick={() => handlePageChange(Math.max(currentPage - 1, 1))}
                                disabled={currentPage === 1}
                                className="bg-black text-white rounded-md px-4 py-1 text-sm"
                            >
                                Previous
                            </Button>
                            
                            {pageNumbers.map((num) => (
                                <Button
                                    key={num}
                                    onClick={() => handlePageChange(num)}
                                    className={`px-2 py-1 rounded-md ${currentPage === num ? 'bg-black text-white' : 'bg-black/60 text-white'}`}
                                >
                                    {num}
                                </Button>
                            ))}

                            <Button 
                                onClick={() => handlePageChange(Math.min(currentPage + 1, totalPages))}
                                disabled={currentPage === totalPages}
                                className="bg-black text-white rounded-md px-4 py-1 text-sm"
                            >
                                Next
                            </Button>
                        </div>
                    </div>
                </div>
            </Card>

            <AddEmployeeModal isOpen={isAddOpen} onClose={() => setIsAddOpen(false)} pushData={pushData} />
            <ViewEmployeeModal isOpen={isViewOpen} onClose={() => setIsViewOpen(false)} employeeId={selectedId} updateData={updateData} api={api} />
            <DeleteEmployeeModal isOpen={isDeleteOpen} onClose={() => setIsDeleteOpen(false)} employeeId={selectedId} updateData={updateData} api={api} />
            <RetrieveEmployeeModal isOpen={isRetrieveOpen} onClose={() => setIsRetrieveOpen(false)} employeeId={selectedId} updateData={updateData} api={api} />
        </div>
    )
}

export default Employees;
