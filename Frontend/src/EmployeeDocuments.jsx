import React, { useEffect, useState } from "react";
import { useNavigate, useOutletContext } from "react-router-dom";
import DocumentEmployeeModal from "./component/modals/documentEmployeeModal"; 

function EmployeeDocuments() {
    const { employeeId } = useOutletContext();
    const navigate = useNavigate();
    const [documents, setDocuments] = useState([]);
    const [loading, setLoading] = useState(true);

    // Modal state
    const [isModalOpen, setIsModalOpen] = useState(false);

    useEffect(() => {
        fetchDocuments();
    }, [employeeId]);

    const fetchDocuments = async () => {
        setLoading(true);
        try {
            const res = await fetch(`http://localhost:3001/api/employee/documents/${employeeId}`);
            const data = await res.json();
            if (data.success) {
                setDocuments(data.documents);
            }
        } catch (err) {
            console.error("Failed to fetch documents:", err);
        } finally {
            setLoading(false);
        }
    };

    const isGoogleDriveLink = (url) => {
        return /^https:\/\/drive\.google\.com\/file\/d\/[a-zA-Z0-9_-]+(\/.*)?$/.test(url);
    };



    const handleDelete = async (documentId) => {
        console.log(documentId);
        try {
            const res = await fetch(`http://localhost:3001/api/employee/documents/${documentId}`, {
                method: 'PATCH',
            });
            const data = await res.json();
            
            if (data.success) {
                setDocuments(prev => prev.filter(doc => doc.id !== documentId));
            }
        } catch (err) {
            console.error("Failed to delete document:", err);
        }
    };

    if (loading) return <p>Loading documents...</p>;

    return (
        <div className="font-inter text-black flex flex-col gap-4">
            <div
                onClick={() => {
                    if (window.history.length > 1) {
                        navigate(-1);
                    } else {
                        navigate("/dashboard"); // or whatever default page
                    }
                }} 
                className="flex w-fit items-center gap-2 text-sm cursor-pointer px-1">
                <span className="text-xl"> &#60; </span>
                <p className="font-medium">Documents</p>
            </div>

            <button
                onClick={() => setIsModalOpen(true)} // open modal on click
                className="bg-black text-white font-light rounded-lg py-3 w-full flex justify-center items-center gap-2"
            >
                Upload New Document
            </button>

            <div className="bg-[#FFC629] shadow-[12px_12px_0_#111827] overflow-hidden">
                <div className="grid grid-cols-3 font-semibold border-b border-black text-sm px-4 py-3">
                    <p>Document</p>
                    <p>Link</p>
                    <p>Status</p>
                </div>

                {documents.map((doc) => (
                    <div
                        key={doc.id}
                        className="grid grid-cols-3 px-4 py-4 border-b border-black text-sm hover:bg-black/10"
                    >
                        <p className="font-medium">{doc.document_type}</p>

                        <p className="flex items-center">
                            {doc.link ? (
                                <a
                                    href={doc.link}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className={isGoogleDriveLink(doc.link) ? "text-blue-600 underline" : "text-red-600"}
                                >
                                    {isGoogleDriveLink(doc.link) ? "View Document" : "Invalid Link"}
                                </a>
                            ) : (
                                <span className="text-gray-400">No link</span>
                            )}
                        </p>

                        <p className={`flex items-center gap-2`}>
                            <span
                                className={
                                    doc.status === "Approved"
                                        ? "text-green-600"
                                        : doc.status === "Incomplete"
                                        ? "text-red-600"
                                        : "text-yellow-600"
                                }
                            >
                                {doc.status}
                            </span>

                            <button
                                onClick={() => handleDelete(doc.document_id)}
                                className="text-sm text-red-600 hover:underline ml-2"
                            >
                                Delete
                            </button>
                        </p>
                    </div>
                ))}
            </div>

            {/* Modal */}
            {isModalOpen && (
                <DocumentEmployeeModal
                    isOpen={isModalOpen}
                    onClose={() => setIsModalOpen(false)}
                    employeeId={employeeId}
                />
            )}
        </div>
    );
}

export default EmployeeDocuments;
