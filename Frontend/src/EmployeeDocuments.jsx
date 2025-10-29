import React from "react";
import { useNavigate } from "react-router-dom";

function EmployeeDocument() {
    const navigate = useNavigate();

    const documents = [
        {
            name: "Medical Certificate",
            code: "DOC-001",
            related: "Leave #123",
            status: "Approved",
            icon: "../img/Approved.png",
        },
        {
            name: "ID Card",
            code: "DOC-002",
            related: "HR Records",
            status: "Missing",
            icon: "../img/Missing.png",
        },
        {
            name: "Training Certificate",
            code: "DOC-003",
            related: "HR Records",
            status: "Approved",
            icon: "../img/Approved.png",
        },
    ];

    return (
        <div className="font-inter text-black flex flex-col gap-4">

            {/* Header */}
            <div className="flex items-center gap-2 text-sm cursor-pointer px-1">
                <span onClick={() => navigate(-1)} className="text-xl">&#60;</span>
                <p className="font-medium">Documents</p>
            </div>

            {/* Upload New Document Button */}
            <button className="bg-black text-white font-light rounded-lg py-3 w-full flex justify-center items-center gap-2">
                <img src="../img/Export_Icon.png" alt="upload" className="w-5 h-5 filter invert" />
                Upload New Document
            </button>

            {/* Documents Table */}
            <div className="bg-[#FFC629] shadow-[12px_12px_0_#111827] rounded-md overflow-hidden">
                <div className="grid grid-cols-3 font-semibold border-b border-black text-sm px-4 py-3">
                    <p>Document</p>
                    <p>Related To</p>
                    <p>Status</p>
                </div>

                {documents.map((doc, index) => (
                    <div
                        key={index}
                        className="grid grid-cols-3 px-4 py-4 border-b border-black text-sm hover:bg-black/10 cursor-pointer"
                    >
                        {/* Document Name */}
                        <div>
                            <p className="font-medium">{doc.name}</p>
                            <p className="text-xs text-black/60">{doc.code}</p>
                        </div>

                        {/* Related To */}
                        <p className="flex items-center">{doc.related}</p>

                        {/* Status */}
                        <p className="flex items-center gap-2 justify-start">
                            <img src={doc.icon} alt={doc.status} className="w-5 h-5" />
                            {doc.status}
                        </p>
                    </div>
                ))}
            </div>
        </div>
    );
}

export default EmployeeDocument;
