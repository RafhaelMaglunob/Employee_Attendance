import { useState, useEffect } from 'react';
import { Check, X, ExternalLink, Edit2 } from 'lucide-react';

export default function DocumentEmployeeModal({ isOpen, onClose, employeeId }) {
	const [employeeName, setEmployeeName] = useState('');
	const [documents, setDocuments] = useState([
		{ id: 1, name: 'SSS ID', link: '', status: 'Incomplete', isEditing: false },
		{ id: 2, name: 'Resume/CV', link: '', status: 'Incomplete', isEditing: false },
		{ id: 3, name: 'Pag-Ibig', link: '', status: 'Incomplete', isEditing: false },
		{ id: 4, name: 'PhilHealth', link: '', status: 'Incomplete', isEditing: false },
		{ id: 5, name: 'Barangay Clearance', link: '', status: 'Incomplete', isEditing: false }
	]);
	const [loading, setLoading] = useState(false);
	const [errors, setErrors] = useState({});

	useEffect(() => {
		if (isOpen && employeeId) {
			fetchEmployeeDocuments();
		}
	}, [isOpen, employeeId]);

	const fetchEmployeeDocuments = async () => {
		setLoading(true);
		try {
			const empResponse = await fetch(`http://192.168.1.9:3001/api/employees/${employeeId}`);
			const empData = await empResponse.json();
			setEmployeeName(empData.fullname || 'Employee');

			const docsResponse = await fetch(`http://192.168.1.9:3001/api/employee/documents/${employeeId}`);
			const docsData = await docsResponse.json();

			if (docsData.success) {
				setDocuments(prev => prev.map(doc => {
					const existing = docsData.documents?.find(d => d.document_type === doc.name);
					return {
						...doc,
						link: existing?.link || '',
						status: existing?.status || 'Incomplete'
					};
				}));
			}
		} catch (error) {
			console.error('Error fetching documents:', error);
		} finally {
			setLoading(false);
		}
	};

	const isGoogleDriveLink = (url) => {
        return /^https:\/\/drive\.google\.com\/(file\/d|drive\/folders)\/[a-zA-Z0-9_-]+(\?.*)?$/.test(url);
    };


	const handleLinkChange = (docId, value) => {
		setDocuments(prev => prev.map(doc => 
			doc.id === docId ? { ...doc, link: value } : doc
		));
		if (errors[docId]) setErrors(prev => ({ ...prev, [docId]: '' }));
	};

	const handleEdit = (docId) => {
		setDocuments(prev => prev.map(doc => 
			doc.id === docId ? { ...doc, isEditing: true } : doc
		));
	};

	const handleSave = async (docId) => {
		const doc = documents.find(d => d.id === docId);

		if (!doc.link.trim()) {
			setErrors(prev => ({ ...prev, [docId]: 'Link cannot be empty' }));
			return;
		}

		if (!isGoogleDriveLink(doc.link)) {
			setErrors(prev => ({ 
				...prev, 
				[docId]: 'Only Google Drive links are allowed (must start with https://drive.google.com/file/d/)' 
			}));
			return;
		}

		try {
			const response = await fetch(`http://192.168.1.9:3001/api/employee/documents/${employeeId}`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ documentType: doc.name, link: doc.link })
			});

			const result = await response.json();

			if (result.success) {
				setDocuments(prev => prev.map(d => 
					d.id === docId 
						? { ...d, isEditing: false, status: 'Approved' }
						: d
				));
				setErrors(prev => ({ ...prev, [docId]: '' }));
			} else {
				setErrors(prev => ({ ...prev, [docId]: result.message || 'Failed to save' }));
			}
		} catch (error) {
			console.error('Save error:', error);
			setErrors(prev => ({ ...prev, [docId]: 'Failed to save document' }));
		}
	};

	const handleCancel = (docId) => {
		setDocuments(prev => prev.map(doc => 
			doc.id === docId ? { ...doc, isEditing: false } : doc
		));
		setErrors(prev => ({ ...prev, [docId]: '' }));
		fetchEmployeeDocuments();
	};

	const handleViewLink = (link) => {
		if (link && isGoogleDriveLink(link)) {
			window.open(link, '_blank', 'noopener,noreferrer');
		}
	};

	if (!isOpen) return null;

	return (
		<div className="fixed inset-0 bg-black/50 backdrop-blur-sm bg-opacity-50 flex items-center justify-center z-50 p-4">
			<div className="bg-white rounded-lg shadow-xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">
				<div className="bg-amber-400 px-6 py-4 rounded-t-lg flex items-center justify-between sticky top-0">
					<h2 className="text-lg font-semibold text-gray-900">
						Update Documents for: {loading ? 'Loading...' : employeeName}
					</h2>
					<button onClick={onClose} className="text-gray-700 hover:text-gray-900 transition-colors">
						<X className="w-6 h-6" />
					</button>
				</div>

				<div className="p-6 space-y-4">
					{loading ? (
						<p className="text-center text-gray-500">Loading documents...</p>
					) : (
						documents.map((doc) => (
							<div key={doc.id} className="border border-gray-300 rounded-md">
								<div className="p-4">
									<div className="flex items-center justify-between mb-3">
										<div className="flex items-center space-x-3">
											<div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center ${
												doc.status === 'Approved' 
													? 'border-green-500 bg-green-50' 
													: 'border-gray-300'
											}`}>
												{doc.status === 'Approved' && (
													<Check className="w-4 h-4 text-green-600" />
												)}
											</div>
											<span className="text-sm font-semibold text-gray-900">
												{doc.name}
											</span>
										</div>

										<span className={`px-3 py-1 rounded-full text-xs font-medium ${
											doc.status === 'Approved' 
												? 'bg-green-100 text-green-700 border border-green-300'
												: doc.status === 'Pending'
												? 'bg-yellow-100 text-yellow-700 border border-yellow-300'
												: 'bg-red-100 text-red-700 border border-red-300'
										}`}>
											{doc.status}
										</span>
									</div>

									{doc.isEditing ? (
										<div className="space-y-2">
											<input
												type="text"
												value={doc.link}
												onChange={(e) => handleLinkChange(doc.id, e.target.value)}
												placeholder="Paste Google Drive link here..."
												className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
											/>
											{errors[doc.id] && (
												<p className="text-xs text-red-600">{errors[doc.id]}</p>
											)}
											<div className="flex gap-2">
												<button
													onClick={() => handleSave(doc.id)}
													className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white text-sm rounded-md transition-colors"
												>
													Save
												</button>
												<button
													onClick={() => handleCancel(doc.id)}
													className="px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-700 text-sm rounded-md transition-colors"
												>
													Cancel
												</button>
											</div>
										</div>
									) : (
										<div className="flex items-center justify-between">
											{doc.link ? (
												<button
													onClick={() => handleViewLink(doc.link)}
													className={`flex items-center gap-2 text-sm ${
														isGoogleDriveLink(doc.link) 
															? 'text-blue-600 hover:text-blue-700' 
															: 'text-red-600'
													} underline`}
												>
													<ExternalLink className="w-4 h-4" />
													{isGoogleDriveLink(doc.link) ? 'View Document' : 'Invalid Link'}
												</button>
											) : (
												<span className="text-sm text-gray-400">No link added</span>
											)}

											<button
												onClick={() => handleEdit(doc.id)}
												className="flex items-center gap-2 px-3 py-2 bg-gray-100 hover:bg-gray-200 rounded-md transition-colors"
											>
												<Edit2 className="w-4 h-4 text-gray-600" />
												<span className="text-sm text-gray-700">Edit</span>
											</button>
										</div>
									)}
								</div>
							</div>
						))
					)}
				</div>

				<div className="px-6 py-4 bg-gray-50 rounded-b-lg border-t border-gray-200">
					<p className="text-xs text-gray-500 mb-2">
						ℹ️ Only Google Drive links are accepted (https://drive.google.com/file/d/...)
					</p>
					<button 
						onClick={onClose}
						className="text-sm text-blue-600 hover:text-blue-700 font-medium"
					>
						Close
					</button>
				</div>
			</div>
		</div>
	);
}
