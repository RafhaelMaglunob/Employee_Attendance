import React, { useEffect, useState } from "react";
import { useNavigate, useOutletContext } from "react-router-dom";
import DocumentEmployeeModal from "./component/modals/documentEmployeeModal"; 
import { useSocket } from "./component/utils/SocketContext";

import MessageModal from "./component/modals/MessageModal";
import ConfirmModal from "./component/modals/ConfirmModal";

function EmployeeDocuments() {
    const { employeeId } = useOutletContext();
    const navigate = useNavigate();
    const { socket, isConnected } = useSocket();
    const [documents, setDocuments] = useState([]);
    const [loading, setLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);

    // Confirm & Message modal states
    const [confirmState, setConfirmState] = useState({ isOpen: false, documentId: null });
    const [messageState, setMessageState] = useState({ isOpen: false, message: "" });

    useEffect(() => {
        fetchDocuments();
    }, [employeeId]);

    useEffect(() => {
        if (!socket || !isConnected) return;

        const handleDocumentUpdate = () => fetchDocuments();
        const handleDocumentDelete = () => fetchDocuments();

        socket.on('documentUpdated', handleDocumentUpdate);
        socket.on('documentDeleted', handleDocumentDelete);

        return () => {
            socket.off('documentUpdated', handleDocumentUpdate);
            socket.off('documentDeleted', handleDocumentDelete);
        };
    }, [socket, isConnected]);

    const fetchDocuments = async () => {
        setLoading(true);
        try {
            const res = await fetch(`http://localhost:3001/api/employee/documents/${employeeId}`);
            const data = await res.json();
            if (data.success) setDocuments(data.documents);
        } catch (err) {
            console.error("Failed to fetch documents:", err);
        } finally {
            setLoading(false);
        }
    };

    const isGoogleDriveLink = (url) => /^https:\/\/drive\.google\.com\/file\/d\/[a-zA-Z0-9_-]+(\/.*)?$/.test(url);

    // Trigger Confirm Modal
    const handleDelete = (documentId) => {
        setConfirmState({ isOpen: true, documentId });
    };

    // Actual deletion after confirm
    const confirmDelete = async () => {
        const documentId = confirmState.documentId;
        setConfirmState({ isOpen: false, documentId: null });

        try {
            const res = await fetch(`http://localhost:3001/api/employee/documents/${documentId}`, {
                method: 'PATCH',
            });
            const data = await res.json();

            if (data.success) {
                setMessageState({ isOpen: true, message: "Document deleted successfully!" });
            } else {
                setMessageState({ isOpen: true, message: data.message || "Failed to remove document" });
            }
        } catch (err) {
            console.error("Failed to delete document:", err);
            setMessageState({ isOpen: true, message: "Error removing document" });
        }
    };

    const closeMessage = () => setMessageState({ isOpen: false, message: "" });

    const getStatusBadge = (status) => {
        const statusConfig = {
            'Approved': 'bg-green-100 text-green-800 border-green-300',
            'Incomplete': 'bg-red-100 text-red-800 border-red-300',
            'Pending': 'bg-yellow-100 text-yellow-800 border-yellow-300'
        };
        return statusConfig[status] || 'bg-gray-100 text-gray-800 border-gray-300';
    };

    const documentTypes = ['SSS ID', 'Resume/CV', 'Pag-Ibig', 'PhilHealth', 'Barangay Clearance'];

    if (loading) {
        return (
            <div className="font-inter text-black min-h-screen flex items-center justify-center">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900 mx-auto mb-4"></div>
                    <p className="text-gray-600">Loading documents...</p>
                </div>
            </div>
        );
    }

    // Completion stats
    const totalDocuments = documentTypes.length;
    const approvedDocuments = documents.filter(doc => doc.status === 'Approved').length;
    const completionPercentage = Math.round((approvedDocuments / totalDocuments) * 100);

    return (
        <div className="font-inter text-black pb-10">
            {/* Header */}
            <div
                onClick={() => {
                    if (window.history.length > 1) navigate(-1);
                    else navigate("/dashboard");
                }} 
                className="flex w-fit items-center gap-2 text-sm cursor-pointer px-1 py-3 hover:bg-gray-100 rounded transition mb-4"
            >
                <span className="text-xl">&#60;</span>
                <p className="font-medium">Documents</p>
            </div>

            {/* Progress Card */}
            <div className="bg-gradient-to-r from-blue-500 to-blue-600 rounded-lg p-6 mb-6 text-white shadow-lg">
                <div className="flex justify-between items-start mb-4">
                    <div>
                        <h2 className="text-2xl font-bold">Document Completion</h2>
                        <p className="text-blue-100 mt-1">Keep your documents up to date</p>
                    </div>
                    <div className="text-right">
                        <div className="text-3xl font-bold">{completionPercentage}%</div>
                        <div className="text-sm text-blue-100">{approvedDocuments} of {totalDocuments} approved</div>
                    </div>
                </div>
                <div className="w-full bg-blue-400 rounded-full h-3 overflow-hidden">
                    <div 
                        className="bg-white h-full rounded-full transition-all duration-500"
                        style={{ width: `${completionPercentage}%` }}
                    ></div>
                </div>
            </div>

            {/* Google Drive Tutorial */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
                <div className="flex items-start gap-3">
                    <div className="flex-shrink-0">
                        <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                    </div>
                    <div className="flex-1">
                        <h3 className="font-semibold text-blue-900 mb-2">How to Get Google Drive Link</h3>
                        <ol className="space-y-2 text-sm text-blue-800">
                            <li className="flex gap-2"><span className="font-semibold">1.</span> Upload your document to Google Drive</li>
                            <li className="flex gap-2"><span className="font-semibold">2.</span> Right-click the file → Click "Share" or "Get link"</li>
                            <li className="flex gap-2"><span className="font-semibold">3.</span> Change access to <strong>"Anyone with the link"</strong></li>
                            <li className="flex gap-2"><span className="font-semibold">4.</span> Copy the link - it should look like:</li>
                        </ol>
                        <div className="mt-3 bg-white border border-blue-300 rounded p-3">
                            <p className="text-xs text-gray-600 mb-1">✅ Correct format:</p>
                            <code className="text-xs text-green-700 break-all">
                                https://drive.google.com/file/d/1ABcDEfGhIjKlMnOpQrStUvWxYz/view?usp=sharing
                            </code>
                            <p className="text-xs text-gray-600 mt-3 mb-1">❌ Remove everything after the file ID:</p>
                            <code className="text-xs text-red-700 line-through break-all">
                                /view?usp=sharing
                            </code>
                            <p className="text-xs text-gray-600 mt-3 mb-1">✅ Final link should be:</p>
                            <code className="text-xs text-green-700 break-all">
                                https://drive.google.com/file/d/1ABcDEfGhIjKlMnOpQrStUvWxYz
                            </code>
                        </div>
                    </div>
                </div>
            </div>

            {/* Upload Button */}
            <button
                onClick={() => setIsModalOpen(true)}
                className="bg-black text-white font-medium rounded-lg py-3 px-6 w-full flex justify-center items-center gap-2 hover:bg-gray-800 transition shadow-md mb-6"
            >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Upload New Document
            </button>

            {/* Documents Grid */}
            <div className="space-y-4">
                <h3 className="font-semibold text-lg mb-3">Required Documents</h3>
                {documents.length === 0 ? (
                    <div className="text-center py-12 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
                        <svg className="w-16 h-16 text-gray-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                        <p className="text-gray-600 text-lg font-medium">No documents uploaded yet</p>
                        <p className="text-gray-500 mt-2">Click the button above to upload your first document</p>
                    </div>
                ) : (
                    documents.map((doc) => (
                        <div key={doc.document_id} className="bg-white border border-gray-200 rounded-lg p-5 hover:shadow-md transition-all">
                            <div className="flex items-start justify-between">
                                <div className="flex items-start gap-4 flex-1">
                                    <div className={`p-3 rounded-lg ${doc.link ? 'bg-blue-50' : 'bg-gray-50'}`}>
                                        <svg className={`w-6 h-6 ${doc.link ? 'text-blue-600' : 'text-gray-400'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                        </svg>
                                    </div>
                                    <div className="flex-1">
                                        <div className="flex items-start justify-between mb-2">
                                            <h4 className="font-semibold text-lg">{doc.document_type}</h4>
                                            <span className={`px-3 py-1 rounded-full text-xs font-semibold border ${getStatusBadge(doc.status)}`}>
                                                {doc.status}
                                            </span>
                                        </div>

                                        {/* Link */}
                                        <div className="mb-3">
                                            {doc.link ? (
                                                <a
                                                    href={doc.link}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className={`inline-flex items-center gap-2 text-sm ${isGoogleDriveLink(doc.link) ? "text-blue-600 hover:text-blue-800 hover:underline" : "text-red-600"}`}
                                                >
                                                    {isGoogleDriveLink(doc.link) ? "View Document" : "Invalid Link Format"}
                                                </a>
                                            ) : (
                                                <span className="text-sm text-gray-400 flex items-center gap-2">No link uploaded</span>
                                            )}
                                        </div>

                                        {/* Delete Button */}
                                        {doc.link && (
                                            <button
                                                onClick={() => handleDelete(doc.document_id)}
                                                className="inline-flex items-center gap-2 text-sm text-red-600 hover:text-red-800 hover:underline transition font-medium"
                                            >
                                                Remove Document
                                            </button>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>
                    ))
                )}
            </div>

            {/* Modals */}
            {isModalOpen && (
                <DocumentEmployeeModal
                    isOpen={isModalOpen}
                    onClose={() => setIsModalOpen(false)}
                    employeeId={employeeId}
                    onSuccess={fetchDocuments}
                />
            )}

            <ConfirmModal
                isOpen={confirmState.isOpen}
                message="Are you sure you want to remove this document?"
                onConfirm={confirmDelete}
                onCancel={() => setConfirmState({ isOpen: false, documentId: null })}
            />

            <MessageModal
                isOpen={messageState.isOpen}
                message={messageState.message}
                onClose={closeMessage}
            />
        </div>
    );
}

export default EmployeeDocuments;
