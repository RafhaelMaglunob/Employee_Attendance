import React, { useState } from 'react'
import { Card } from './component/ui/card'
import { Table } from './component/data/table'
import { Button } from './component/ui/button'

const columns = ["All Incidents", "Pending", "Resolved"]

function Incident() {
    const [activeTab, setActiveTab] = useState("All Incidents");

    return (
        <div>
            <h1 className="font-bold text-2xl">Incident Reports</h1>
            <div className="flex flex-row justify-between w-full space-x-10">
                <Card 
                    className="flex-[2.5] self-auto h-[90%]" 
                    title="Incidents"
                    titleSize="lg"
                    variant="admin" 
                    radius='none'
                >
                    <div>
                        <thread className="flex space-x-6 w-full border-b mb-5">
                            {columns.map((col, index) => {
                                return (
                                    <Button
                                        key={index}
                                        className={`text-sm border-b-2 ${activeTab.toLowerCase() === col.toLowerCase() ? "border-current" : "border-transparent"}`}
                                        onClick={() => setActiveTab(col)}
                                    >
                                        {col}
                                    </Button>
                                )
                            })}
                        </thread>

                        <Table columns={columns} data=""></Table>
                    </div>
                </Card>
                <div className="flex-[2]">
                    <Card 
                        className="" 
                        title={"Incidents"} 
                        titleSize={"lg"} 
                        variant="admin" 
                        radius='none'
                    >
                    </Card>
                </div>
            </div>
        </div>
    )
}

export default Incident
