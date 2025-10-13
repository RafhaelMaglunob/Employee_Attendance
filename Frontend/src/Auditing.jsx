import { useState } from 'react'
import { Card } from './component/ui/card'
import { Button } from './component/ui/button'
import { Search } from './component/ui/search'
import { Filter } from './component/ui/filter'
function Auditing() {

    const [selectedSort, setSelectedSort] = useState("Filter");

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
                    />
                </div>

            <Search className="flex-1"></Search>
            <Filter value={selectedSort} className="text-black flex-1">
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
    )

    return( 
        <>  
            <h1 className="font-bold text-2xl mb-3 mt-3">Auditing Logs</h1>
            <Card header={headerContent} radius="none" variant="admin" width="full">
                
            </Card>
        </>
    );
}

export default Auditing;