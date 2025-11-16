import PDFDocument from 'pdfkit';
import fs from 'fs';
import path from 'path';
import { syncRow } from '../utils/syncToSupabase.js';
import { getIo } from '../socket.js';

export function certificateController(pool) {

    // ========================================
    // EMPLOYEE: Request Certificate
    // ========================================
    const requestCertificate = async (req, reply) => {
        const { id: employeeId } = req.params;
        const { purpose } = req.body;

        try {
            if (!purpose || purpose.trim() === '') {
                return reply.status(400).send({
                    success: false,
                    message: 'Purpose is required'
                });
            }

            // Check if employee exists
            const { rows: empCheck } = await pool.query(
                `SELECT employee_id FROM employees WHERE employee_id = $1`,
                [employeeId]
            );

            if (empCheck.length === 0) {
                return reply.status(404).send({
                    success: false,
                    message: 'Employee not found'
                });
            }

            // Insert certificate request
            const { rows } = await pool.query(
                `INSERT INTO certificate_requests (employee_id, purpose, status)
                VALUES ($1, $2, 'Pending')
                RETURNING *`,
                [employeeId, purpose]
            );

            const newRequest = rows[0];

            // Sync to Supabase
            setImmediate(async () => {
                try {
                    await syncRow('certificate_requests', newRequest, 'certificate_id');
                } catch (err) {
                    console.error('Supabase sync error:', err);
                }
            });

            // Emit real-time notification to admins
            const io = getIo();
            io.emit('newCertificateRequest', newRequest);

            return reply.send({
                success: true,
                message: 'Certificate request submitted successfully',
                data: newRequest
            });

        } catch (error) {
            console.error('Error requesting certificate:', error);
            return reply.status(500).send({
                success: false,
                message: 'Failed to submit certificate request'
            });
        }
    };

    // ========================================
    // EMPLOYEE: Get My Certificate Requests
    // ========================================
    const getMyCertificates = async (req, reply) => {
        const { id: employeeId } = req.params;

        try {
            const { rows } = await pool.query(
                `SELECT 
                    cr.*,
                    e.fullname as approved_by_name
                FROM certificate_requests cr
                LEFT JOIN employees e ON e.employee_id = cr.approved_by
                WHERE cr.employee_id = $1
                ORDER BY cr.request_date DESC`,
                [employeeId]
            );

            return reply.send({
                success: true,
                data: rows
            });

        } catch (error) {
            console.error('Error fetching certificates:', error);
            return reply.status(500).send({
                success: false,
                message: 'Failed to fetch certificates'
            });
        }
    };

    // ========================================
    // ADMIN/HR: Get All Certificate Requests
    // ========================================
    const getAllCertificateRequests = async (req, reply) => {
        const { status } = req.query; // Filter by status (optional)

        try {
            let query = `
                SELECT 
                    cr.*,
                    e.fullname,
                    e.position,
                    e.employment_type,
                    e.email,
                    approver.fullname as approved_by_name
                FROM certificate_requests cr
                JOIN employees e ON e.employee_id = cr.employee_id
                LEFT JOIN employees approver ON approver.employee_id = cr.approved_by
            `;

            const params = [];
            if (status) {
                query += ` WHERE cr.status = $1`;
                params.push(status);
            }

            query += ` ORDER BY cr.request_date DESC`;

            const { rows } = await pool.query(query, params);

            return reply.send({
                success: true,
                data: rows
            });

        } catch (error) {
            console.error('Error fetching certificate requests:', error);
            return reply.status(500).send({
                success: false,
                message: 'Failed to fetch certificate requests'
            });
        }
    };

    // ========================================
    // ADMIN/HR: Approve Certificate & Generate PDF
    // ========================================
    const approveCertificate = async (req, reply) => {
        const { certificateId } = req.params;
        const { approvedBy, remarks } = req.body; // approvedBy = admin's employee_id

        try {
            // Get certificate request details
            const { rows: certRows } = await pool.query(
                `SELECT cr.*, e.fullname, e.position, e.employment_type, e.created_at as hire_date
                FROM certificate_requests cr
                JOIN employees e ON e.employee_id = cr.employee_id
                WHERE cr.certificate_id = $1`,
                [certificateId]
            );

            if (certRows.length === 0) {
                return reply.status(404).send({
                    success: false,
                    message: 'Certificate request not found'
                });
            }

            const cert = certRows[0];

            // Generate PDF
            const pdfPath = await generateCertificatePDF(cert, pool);

            // Update certificate status
            const { rows: updated } = await pool.query(
                `UPDATE certificate_requests
                SET status = 'Approved',
                    approved_by = $1,
                    approved_date = NOW(),
                    remarks = $2,
                    pdf_link = $3,
                    updated_at = NOW()
                WHERE certificate_id = $4
                RETURNING *`,
                [approvedBy, remarks || '', pdfPath, certificateId]
            );

            const updatedCert = updated[0];

            // Sync to Supabase
            setImmediate(async () => {
                try {
                    await syncRow('certificate_requests', updatedCert, 'certificate_id');
                } catch (err) {
                    console.error('Supabase sync error:', err);
                }
            });

            // Emit real-time notification to employee
            const io = getIo();
            io.to(`employee_${cert.employee_id}`).emit('certificateApproved', updatedCert);

            return reply.send({
                success: true,
                message: 'Certificate approved and PDF generated',
                data: updatedCert,
                pdfPath
            });

        } catch (error) {
            console.error('Error approving certificate:', error);
            return reply.status(500).send({
                success: false,
                message: 'Failed to approve certificate'
            });
        }
    };

    // ========================================
    // ADMIN/HR: Reject Certificate
    // ========================================
    const rejectCertificate = async (req, reply) => {
        const { certificateId } = req.params;
        const { rejectedBy, remarks } = req.body;

        try {
            const { rows } = await pool.query(
                `UPDATE certificate_requests
                SET status = 'Rejected',
                    approved_by = $1,
                    approved_date = NOW(),
                    remarks = $2,
                    updated_at = NOW()
                WHERE certificate_id = $3
                RETURNING *`,
                [rejectedBy, remarks || '', certificateId]
            );

            if (rows.length === 0) {
                return reply.status(404).send({
                    success: false,
                    message: 'Certificate request not found'
                });
            }

            const updatedCert = rows[0];

            // Sync to Supabase
            setImmediate(async () => {
                try {
                    await syncRow('certificate_requests', updatedCert, 'certificate_id');
                } catch (err) {
                    console.error('Supabase sync error:', err);
                }
            });

            // Emit real-time notification
            const io = getIo();
            io.to(`employee_${updatedCert.employee_id}`).emit('certificateRejected', updatedCert);

            return reply.send({
                success: true,
                message: 'Certificate request rejected',
                data: updatedCert
            });

        } catch (error) {
            console.error('Error rejecting certificate:', error);
            return reply.status(500).send({
                success: false,
                message: 'Failed to reject certificate'
            });
        }
    };

    // ========================================
    // PDF Generation Function
    // ========================================
    const generateCertificatePDF = async (cert, pool) => {
        return new Promise(async (resolve, reject) => {
            try {
                // Create certificates directory if it doesn't exist
                const certsDir = path.join(process.cwd(), 'certificates');
                if (!fs.existsSync(certsDir)) {
                    fs.mkdirSync(certsDir, { recursive: true });
                }

                const fileName = `COE_${cert.employee_id}_${Date.now()}.pdf`;
                const filePath = path.join(certsDir, fileName);

                // Create PDF document
                const doc = new PDFDocument({
                    size: 'A4',
                    margins: { top: 50, bottom: 50, left: 72, right: 72 }
                });

                // Pipe to file
                const stream = fs.createWriteStream(filePath);
                doc.pipe(stream);

                // Get company info (you can store this in a settings table)
                const companyName = "The Crunch Business Solutions";
                const companyAddress = "123 Business St, Metro Manila, Philippines";
                const todayDate = new Date().toLocaleDateString('en-US', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric'
                });

                // Format hire date
                const hireDate = new Date(cert.hire_date).toLocaleDateString('en-US', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric'
                });

                // Header
                doc.fontSize(20)
                   .font('Helvetica-Bold')
                   .text('CERTIFICATE OF EMPLOYMENT', { align: 'center' });

                doc.moveDown(2);

                // Date
                doc.fontSize(12)
                   .font('Helvetica')
                   .text(todayDate, { align: 'right' });

                doc.moveDown(2);

                // Salutation
                doc.text('TO WHOM IT MAY CONCERN:', { align: 'left' });

                doc.moveDown(1.5);

                // Body
                doc.fontSize(12)
                   .font('Helvetica')
                   .text(
                       `This is to certify that ${cert.fullname.toUpperCase()} has been employed with ${companyName} ` +
                       `since ${hireDate} to present as ${cert.position}.`,
                       { align: 'justify' }
                   );

                doc.moveDown(1);

                doc.text(
                    `During the tenure of employment, the employee demonstrated professionalism and dedication ` +
                    `in fulfilling their responsibilities.`,
                    { align: 'justify' }
                );

                doc.moveDown(1);

                doc.text(
                    `This certification is being issued upon the request of the employee for ${cert.purpose.toLowerCase()}.`,
                    { align: 'justify' }
                );

                doc.moveDown(3);

                // Signature section
                doc.text('Issued by:', { align: 'left' });
                doc.moveDown(2);

                doc.text('_____________________________', { align: 'left' });
                doc.text('HR Manager / Authorized Signatory', { align: 'left' });
                doc.text(companyName, { align: 'left' });

                doc.moveDown(1);

                // Footer
                doc.fontSize(10)
                   .font('Helvetica-Oblique')
                   .text(companyAddress, { align: 'center' });

                // Finalize PDF
                doc.end();

                stream.on('finish', () => {
                    resolve(`/certificates/${fileName}`);
                });

                stream.on('error', reject);

            } catch (error) {
                reject(error);
            }
        });
    };

    // ========================================
    // Download PDF
    // ========================================
    const downloadCertificate = async (req, reply) => {
        const { certificateId } = req.params;

        try {
            const { rows } = await pool.query(
                `SELECT pdf_link FROM certificate_requests WHERE certificate_id = $1`,
                [certificateId]
            );

            if (rows.length === 0 || !rows[0].pdf_link) {
                return reply.status(404).send({
                    success: false,
                    message: 'Certificate not found or not yet generated'
                });
            }

            const pdfPath = path.join(process.cwd(), rows[0].pdf_link);

            if (!fs.existsSync(pdfPath)) {
                return reply.status(404).send({
                    success: false,
                    message: 'PDF file not found'
                });
            }

            return reply.sendFile(path.basename(pdfPath), path.dirname(pdfPath));

        } catch (error) {
            console.error('Error downloading certificate:', error);
            return reply.status(500).send({
                success: false,
                message: 'Failed to download certificate'
            });
        }
    };

    return {
        requestCertificate,
        getMyCertificates,
        getAllCertificateRequests,
        approveCertificate,
        rejectCertificate,
        downloadCertificate
    };
}