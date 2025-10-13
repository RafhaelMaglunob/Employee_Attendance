import React, { useState, useEffect, useMemo } from 'react';
import { Search } from './component/ui/search';
import { applySearchAndFilter } from './component/utils/applySearchFilter';
import { PaginatedTable } from './component/data/table'; // <-- Use PaginatedTable
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
            { img: "../img/Edit_Icon.png", alt: "View Icon", onClick: () => handleView(row) },
            { img: "../img/Reports_Icon.png", alt: "Report Icon", onClick: () => handleDocuments(row) },
            { img: "../img/Delete_Icon.png", alt: "Delete Icon", onClick: () => handleDelete(row) }
        ];
    } else if (activeTab === "archive") {
        return [
            { img: "../img/Edit_Icon.png", alt: "View Icon", onClick: () => handleRetrieve(row) }
        ];
    }
    return [];
};

function Employees() {
    const savedTab = (localStorage.getItem("employeeTab") || "employed").toLowerCase();
    const savedSort = localStorage.getItem("employeeSort") || "Filter";
    const itemsPerPage = 5;

    const [query, setQuery] = useState("");
    const [activeTab, setActiveTab] = useState(savedTab);
    const [api, setApi] = useState(activeTab === "employed" ? "employees" : "archive");
    const [selectedSort, setSelectedSort] = useState(savedSort);
    const [selectedId, setSelectedId] = useState(null);
    const [isAddOpen, setIsAddOpen] = useState(false);
    const [isViewOpen, setIsViewOpen] = useState(false);
    const [isDeleteOpen, setIsDeleteOpen] = useState(false);
    const [isRetrieveOpen, setIsRetrieveOpen] = useState(false);

    useEffect(() => { localStorage.setItem("employeeSort", selectedSort) }, [selectedSort]);
    useEffect(() => { localStorage.setItem("employeeTab", activeTab) }, [activeTab]);

    const handleView = (row) => { setSelectedId(row.employee_id); setIsViewOpen(true); };
    const handleRetrieve = (row) => { setSelectedId(row.employee_id); setIsRetrieveOpen(true); };
    const handleDelete = (row) => { setSelectedId(row.employee_id); setIsDeleteOpen(true); };
    const handleDocuments = (row) => {};

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
            render: row => (
                <span className={`px-4 py-1 rounded-[40px] text-[10px] border ${
                    activeTab === "archive" ? "bg-[#FEE2E2] border-[#991B1B]" 
                    : row.status === "Employed" ? "bg-[#DCFCE7] border-[#166534]" 
                    : "bg-[#FEF9C3] border-[#854D0E]"
                }`}>{row.status}</span>
            )
        },
        {
            key: "documents",
            title: "Documents",
            render: row => (
                <span className={`px-4 py-1 rounded-[40px] text-[10px] border ${
                    row.documents_complete ? "bg-[#DCFCE7] border-[#166534]" : "bg-[#FEF9C3] border-[#854D0E]"
                }`}>{row.documents_complete ? "Complete" : "Incomplete"}</span>
            )
        },
        {
            key: "actions",
            title: "Actions",
            render: row => {
                const buttons = getActionButtons(row, activeTab, handleView, handleDocuments, handleDelete, handleRetrieve);
                return (
                    <div className="flex gap-2">
                        {buttons.map((btn, idx) => (
                            <Button key={idx} onClick={btn.onClick} className="rounded-[50px] hover:bg-black/20 w-10 h-10">
                                <img src={btn.img} alt={btn.alt} />
                            </Button>
                        ))}
                    </div>
                );
            }
        }
    ];

    const filteredData = useMemo(() => {
        let tempData = applySearchAndFilter(data, query, ["employee_id", "name", "position", "type", "status"], "", "");

        if (selectedSort === "ASC") {
            tempData = tempData.sort((a, b) => a.employee_id.localeCompare(b.employee_id));
        } else if (selectedSort === "DESC") {
            tempData = tempData.sort((a, b) => b.employee_id.localeCompare(a.employee_id));
        }

        return tempData;
    }, [data, query, selectedSort]);


    const headerContent = (
        <div className="flex items-center w-full gap-4">
            <div className="flex-1">
                <Search value={query} onChange={setQuery} placeholder="Search employees..." />
            </div>
            <div className="w-[10%] flex-none">
                <Filter value={selectedSort} className="text-black">
                    <Button className="w-full text-left px-3 py-2 hover:bg-gray-100" onClick={() => setSelectedSort("ASC")}>ASC</Button>
                    <Button className="w-full text-left px-3 py-2 hover:bg-gray-100" onClick={() => setSelectedSort("DESC")}>DESC</Button>
                </Filter>
            </div>
        </div>
    );

    if (loading) return <p className="text-gray-400 text-xl">Loading</p>;

    return (
        <div className="pb-6">
            <div className="flex justify-between mb-3 mt-3 mr-3">
                <h1 className="font-bold text-2xl">Employee Records</h1>
                <Button onClick={() => setIsAddOpen(true)} className="bg-black text-white px-4 py-1 rounded-lg text-sm">+ Add Employee</Button>
            </div>

            <Card header={headerContent} radius="none" variant="admin" width="full">
                <div className="flex space-x-7 font-inter text-xs border-b-1">
                    {tabList.map((tab, index) => (
                        <Button
                            key={index}
                            onClick={() => { 
                                const lowerTab = tab.toLowerCase();
                                setActiveTab(lowerTab);
                                localStorage.setItem("employeeTab", lowerTab);
                                setApi(lowerTab === "employed" ? "employees" : "archive");
                             }}
                            className={`border-b-2 pb-2 ${activeTab === tab.toLowerCase() ? "border-current" : "border-transparent"}`}
                        >
                            {tab}
                        </Button>
                    ))}
                </div>

                <div className="mt-5">
                    {/* Use PaginatedTable instead */}
                    <PaginatedTable columns={columns} data={filteredData} itemsPerPage={itemsPerPage} />
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
