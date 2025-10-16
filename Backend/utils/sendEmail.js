// utils/sendEmail.js
import nodemailer from 'nodemailer';

export async function sendEmployeeEmail(to, fullname, employeeId, tempPassword) {
    try {
        const transporter = nodemailer.createTransport({
            service: 'gmail',
            auth: {
                user: process.env.GMAIL_ADDRESS,
                pass: process.env.GMAIL_APP_PASSWORD,
            }
        });

        const mail = {
            from: `"Your Company" <${process.env.GMAIL_ADDRESS}>`,
            to,
            subject: 'Your temporary account password',
            text: `Hello ${fullname},

Your Employee ID is: ${employeeId}
Your temporary password is: ${tempPassword}

For security, this password will expire on first use. Please sign in and change your password immediately.`
        };

        await transporter.sendMail(mail);
        console.log("Email Sent to", to);
    } catch (err) {
        console.error("Email sending failed:", err.message);
    }
}
