import { useState, useMemo, useEffect } from 'react'
import { Card } from './component/ui/card'
import { Button } from './component/ui/button'
import { Search } from './component/ui/search'
import { Filter } from './component/ui/filter'
import { PaginatedTable } from './component/data/table'
import { useFetchData } from './component/hooks/useFetchData'
import { applySearchAndFilter } from './component/utils/applySearchFilter';
import { exportTableToPdf } from './component/utils/exportablePdf'

function Auditing() {
    const itemsPerPage = 5;
    const savedSort = localStorage.getItem("auditSort") || "Filter";
    
    const [selectedDate, setSelectedDate] = useState("");
    const [selectedSort, setSelectedSort] = useState(savedSort);
    const [query, setQuery] = useState("")

    useEffect(() => { localStorage.setItem("auditSort", selectedSort) }, [selectedSort]);
        
    const transformEmployee = (emp) => ({
        name: emp.employee_name,
        action: emp.action,
        action_stamp: emp.action_time,
        remarks: emp.remarks
    });

    const { data, loading } = useFetchData(
        `http://localhost:3001/api/audit`,
        transformEmployee
    );

    const columns = [
        { key: "action", title: "Action" },
        { key: "name", title: "Employee" },
        { key: "action_stamp", title: "Timestamp" },
        { key: "remarks", title: "Details" },
    ]
    
    const filteredData = useMemo(() => {
        let tempData = applySearchAndFilter(data, query, ["action", "name", "action_stamp", "remarks"], "", "");

        if (selectedDate) {
            tempData = tempData.filter(item => 
                item.action_stamp.startsWith(selectedDate)
            );
        }

        if (selectedSort === "ASC") {
            tempData = tempData.sort((a, b) => new Date(a.action_stamp) - new Date(b.action_stamp));
        } else if (selectedSort === "DESC") {
            tempData = tempData.sort((a, b) => new Date(b.action_stamp) - new Date(a.action_stamp));
        }

        return tempData;
    }, [data, query, selectedSort, selectedDate]);

    const headerContent = (
        <div className="flex flex-row gap-2 w-full">
                <div 
                    className="px-2 py-1 flex flex-row flex-1 bg-white rounded-lg items-center cursor-pointer"
                    onClick={() => document.getElementById("dateInput").showPicker()} // for modern browsers
                >
                    <img src="../img/Date_Icon.png" alt="Date Icon" className="w-5 h-5 mr-2"/>
                    <input
                        type="date"
                        id="dateInput"
                        className="text-black min-w-0 flex-1"
                        value={selectedDate}
                        onChange={(e) => setSelectedDate(e.target.value)}
                    />
                </div>

            <Search value={query} onChange={setQuery} placeholder="Search employees..." className="flex-1"></Search>
            <Filter value={selectedSort} className="text-black flex-1">
                <Button className="w-full text-left px-3 py-2 hover:bg-gray-100" onClick={() => setSelectedSort("ASC")}>ASC</Button>
                <Button className="w-full text-left px-3 py-2 hover:bg-gray-100" onClick={() => setSelectedSort("DESC")}>DESC</Button>
            </Filter>
        </div>
    )
    
    if (loading) return <p className="text-gray-400 text-xl">Loading</p>;

    return( 
        <>  
            <div className="flex justify-between items-center mb-3 mt-3 mr-3">
                <h1 className="font-bold text-2xl">Audit Logs</h1>
                <div className="flex items-center px-2 py-1 bg-white border rounded-xl cursor-pointer hover:bg-gray-100">
                    <img src="../img/Export_Icon.png" alt="Export Icon" className="w-5 h-5 mr-2" />
                    <Button
                        onClick={() => exportTableToPdf(columns, filteredData, `audit_logs_${new Date().toISOString()}.docx`)}
                        className="font-bold text-sm px-2 py-1"
                    >
                        Export Logs
                    </Button>
                </div>
            </div>

            <Card header={headerContent} radius="none" variant="admin" width="full">
                <PaginatedTable columns={columns} data={filteredData} itemsPerPage={itemsPerPage}></PaginatedTable>
            </Card>
        </>
    );
}

export default Auditing;