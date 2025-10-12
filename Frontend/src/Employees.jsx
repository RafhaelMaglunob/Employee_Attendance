import React from 'react';
import { useState, useEffect, useMemo } from 'react'
import { Search } from './component/ui/search'
import { applySearchAndFilter } from './component/utils/applySearchFilter';
import { Table } from './component/data/table';
import { Card } from './component/ui/card';
import { Button } from './component/ui/button';
import { Filter } from './component/ui/filter';
import { useFetchData } from './component/hooks/useFetchData';
import AddEmployeeModal from './component/modals/AddEmployeeModal';
import EditEmployeeModal from './component/modals/EditEmployeeModal';

const tabList = [ "Employed", "Archive" ]

function Employees() {
    const itemsPerPage = 5; 
    const [query, setQuery] = useState("")
    const [activeTab, setActiveTab] = useState("employed")
    const [selectedSort, setSelectedSort] = useState("ASC");
    const [currentPage, setCurrentPage] = useState(1);
    const [selectedId, setSelectedId] = useState(null);
    const [isAddOpen, setIsAddOpen] = useState(false);
    const [isEditOpen, setIsEditOpen] = useState(false);

    const columns = [
        { key: "employee_id", title: "Employee ID" },
        { key: "name", title: "Name" },
        { key: "position", title: "Position" },
        { key: "type", title: "Type"},
        { key: "status", title: "Status"},
        { key: "documents", title: "Documents"},
        { key: "actions",
            title: "Actions",
            render: (row) => (
                <div className="flex gap-2">
                    <Button 
                        onClick={() => handleEdit(row)}
                        className="rounded-[50px] hover:bg-black/20 w-10 h-10"
                    >
                        <img src="../img/Edit_Icon.png" alt="Edit Icon"></img>
                    </Button>

                    <Button 
                        onClick={() => handleDocuments(row)}
                        className="rounded-[50px] hover:bg-black/20 mr-2 ml-2"
                    >
                        <img src="../img/Reports_Icon.png" alt="Reports Icon"></img>
                    </Button>

                    <Button 
                        onClick={() => handleDelete(row.employee_id)}
                        className="rounded-[50px] hover:bg-black/20"
                    >
                        <img src="../img/Delete_Icon.png" alt="Delete Icon"></img>
                    </Button>
                </div>
            )
        }
    ];

    const transformEmployee = (emp) => ({
        employee_id: emp.employee_id,
        name: emp.fullname,
        position: emp.position,
        type: emp.employment_type,
        status: 
            activeTab.toLowerCase() === "archive" ? (
                <span className="px-4 py-1 bg-[#FEE2E2] border border-[#991B1B] text-[10px] rounded-[40px]">
                    {emp.status}
                </span>     
            ) : (
                <span className={`px-4 py-1 ${emp.status === "Employed" ? "bg-[#DCFCE7]" : "bg-[#FEF9C3]"} border border-[#166534] text-[10px] rounded-[40px]`}>
                    {emp.status}
                </span>
            ),
        documents: emp.documents_complete
            ? <span className="px-4 py-1 bg-[#DCFCE7] border border-[#166534] text-[10px] rounded-[40px]">Complete</span>
            : <span className="px-4 py-1 bg-[#FEF9C3] border border-[#854D0E] text-[10px] rounded-[40px]">Incomplete</span>,
    });
    
    const { data, loading, pushData, updateData } = useFetchData(
        activeTab.toLowerCase() === "employed"
          ? "http://localhost:3001/api/employees"
          : "http://localhost:3001/api/archive",
        transformEmployee,
    );

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
    const handleAddEmployee = () => setIsAddOpen(true);

    const handleDelete = async (id) => {
        if (!window.confirm("Are you sure you want to delete this employee?")) return;
        try {
            const res = await fetch(`http://localhost:3001/api/employees/${id}`, { method: "DELETE" });
            if (!res.ok) throw new Error("Delete failed");
            await res.json();
            updateData(prev => prev.filter(emp => emp.employee_id !== id));
        } catch (err) {
            console.error("Failed to delete employee:", err);
        }
    };

    const handleEdit = (row) => {
        setSelectedId(row.employee_id);
        setIsEditOpen(true);
    };

    const handleDocuments = (row) => {
        // Implement if needed
    };

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

    const sortedData = useMemo(() => {
        if (!selectedSort) return filteredData;

        return [...filteredData].sort((a, b) => {
            // Example: sort by name
            const nameA = a.name.toUpperCase();
            const nameB = b.name.toUpperCase();

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

    
    useEffect(() => {
        const totalPages = Math.ceil(filteredData.length / itemsPerPage);
        if (currentPage > totalPages) {
            setCurrentPage(totalPages || 1); // go to last page or 1 if no data
        }
    }, [filteredData, currentPage, itemsPerPage]);

    
    if (loading) return <p className="text-gray-400 text-xl">Loading</p>;

    return (
        <>
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
                            onClick={() => { setActiveTab(tab.toLowerCase()); setCurrentPage(1); }}
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
                                onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                                disabled={currentPage === 1}
                                className="bg-black text-white rounded-md px-4 py-1 text-sm"
                            >
                                Previous
                            </Button>

                            {Array.from({ length: totalPages }, (_, i) => (
                                <Button
                                    key={i}
                                    onClick={() => setCurrentPage(i + 1)}
                                    className={`px-2 py-1 rounded-md ${currentPage === i + 1 ? 'bg-black text-white' : 'bg-black/60 text-white'}`}
                                >
                                    {i + 1}
                                </Button>
                            ))}

                            <Button 
                                onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
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
            <EditEmployeeModal isOpen={isEditOpen} onClose={() => setIsEditOpen(false)} employeeId={selectedId} updateData={updateData} />
        </>
    )
}

export default Employees;
