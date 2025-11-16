import nodemailer from "nodemailer";
import { DateTime } from 'luxon';
import fs from "fs";
import path from "path";
import dns from "dns";

const QUEUE_FILE = path.resolve("./emailQueue.json");

// 🔹 Save failed emails for later sending
function saveToQueue(emailData) {
	let queue = [];
	if (fs.existsSync(QUEUE_FILE)) {
		queue = JSON.parse(fs.readFileSync(QUEUE_FILE, "utf-8"));
	}
	queue.push(emailData);
	fs.writeFileSync(QUEUE_FILE, JSON.stringify(queue, null, 2));
}

// 🔹 Check internet connection
function isOnline() {
	return new Promise((resolve) => {
		dns.lookup("google.com", (err) => resolve(!err));
	});
}

// 🔹 Send email immediately
async function sendEmailNow(mail) {
    const transporter = nodemailer.createTransport({
        service: "gmail",
        auth: {
            user: process.env.GMAIL_ADDRESS,
            pass: process.env.GMAIL_APP_PASSWORD,
        },
    });

    try {
        await transporter.sendMail(mail);
        console.log(`✅ Email sent to ${mail.to}`);
    } catch (err) {
        console.error(`❌ Failed to send email to ${mail.to}:`, err.message);
        throw err; // allow queueing
    }
}


// 🔹 Retry queued emails when online
async function resendQueuedEmails() {
	if (!fs.existsSync(QUEUE_FILE)) return;
	const queue = JSON.parse(fs.readFileSync(QUEUE_FILE, "utf-8"));
	if (queue.length === 0) return;

	console.log(`📤 Sending ${queue.length} queued emails...`);
	const remaining = [];

	for (const mail of queue) {
		try {
			await sendEmailNow(mail);
		} catch (err) {
			console.error(`❌ Failed to resend to ${mail.to}:`, err.message);
			remaining.push(mail);
		}
	}

	fs.writeFileSync(QUEUE_FILE, JSON.stringify(remaining, null, 2));
}

// 🔹 Generic send handler (used by all)
async function sendMailWithQueue(mail) {
	if (await isOnline()) {
		try {
			await sendEmailNow(mail);
		} catch (err) {
			console.error("❌ Send failed, saving to queue:", err.message);
			saveToQueue(mail);
		}
	} else {
		console.log("📴 Offline detected, saving email for later.");
		saveToQueue(mail);
	}
}

// ✅ Original: Send temporary password
export async function sendEmployeeEmail(to, fullname, tempPassword) {
	const mail = {
		from: `"The Crunch Bistro & Sizzlers" <${process.env.GMAIL_ADDRESS}>`,
		to,
		subject: "Your Temporary Account Password",
		text: `Hello ${fullname},

Your email is: ${to}
Your temporary password is: ${tempPassword}

For security, please change your password immediately after logging in.

– HR Department`,
	};
	await sendMailWithQueue(mail);
}

// ✅ NEW: Send password reset email
// Update the sendPasswordResetEmail function (around line 63)
export async function sendPasswordResetEmail(to, fullname, resetToken, userType = 'admin') {
    // Determine URL based on user type
    let resetUrl;
    if (userType === 'employee') {
        resetUrl = `${process.env.FRONTEND_URL4 || 'http://192.168.1.9:5173'}/employee/reset-password/${resetToken}`;
    } else {
        resetUrl = `${process.env.FRONTEND_URL4 || 'http://192.168.1.9:5173'}/reset-password/${resetToken}`;
    }

    const mail = {
        from: `"The Crunch Bistro & Sizzlers" <${process.env.GMAIL_ADDRESS}>`,
        to,
        subject: "Password Reset Request - Employee Management System",
        html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
                <div style="background-color: #FFC629; padding: 20px; text-align: center; border-bottom: 8px solid #5E451D;">
                    <h1 style="color: #000; margin: 0;">The Crunch Bistro & Sizzlers</h1>
                    <p style="color: #5E451D; margin: 5px 0;">Employee Management System</p>
                </div>
                
                <div style="padding: 30px; background-color: #f9f9f9;">
                    <h2 style="color: #333;">Password Reset Request</h2>
                    <p style="color: #666; line-height: 1.6;">
                        Hello <strong>${fullname}</strong>,
                    </p>
                    <p style="color: #666; line-height: 1.6;">
                        You requested to reset your password for the Employee Management System.
                    </p>
                    <p style="color: #666; line-height: 1.6;">
                        Click the button below to reset your password:
                    </p>
                    
                    <div style="text-align: center; margin: 30px 0;">
                        <a href="${resetUrl}" 
                           style="display: inline-block; padding: 15px 30px; background-color: #000; 
                                  color: #fff; text-decoration: none; border-radius: 5px; 
                                  font-weight: bold; font-size: 16px;">
                            Reset Password
                        </a>
                    </div>
                    
                    <p style="color: #666; font-size: 14px; line-height: 1.6;">
                        Or copy and paste this link into your browser:
                    </p>
                    <p style="color: #0066cc; word-break: break-all; font-size: 13px;">
                        ${resetUrl}
                    </p>
                    
                    <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #ddd;">
                        <p style="color: #999; font-size: 12px; line-height: 1.4;">
                            ⏰ This link will expire in <strong>1 hour</strong>.
                        </p>
                        <p style="color: #999; font-size: 12px; line-height: 1.4;">
                            🔒 If you didn't request this, please ignore this email and your password will remain unchanged.
                        </p>
                    </div>
                </div>
                
                <div style="background-color: #333; color: #fff; padding: 15px; text-align: center; font-size: 12px;">
                    <p style="margin: 0;">© 2025 The Crunch Bistro & Sizzlers. All rights reserved.</p>
                </div>
            </div>
        `
    };

    // 🔹 Logging to confirm send attempt
    console.log(`📤 Attempting to send password reset email to: ${to}`);
    try {
        await sendMailWithQueue(mail);
        console.log(`✅ Password reset email successfully queued/sent to: ${to}`);
    } catch (err) {
        console.error(`❌ Failed to send password reset email to ${to}:`, err.message);
    }
}


// ✅ NEW: Send password changed confirmation email
export async function sendPasswordChangedEmail(to, fullname) {
	const mail = {
		from: `"The Crunch Bistro & Sizzlers" <${process.env.GMAIL_ADDRESS}>`,
		to,
		subject: "Password Successfully Changed",
		html: `
			<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
				<div style="background-color: #FFC629; padding: 20px; text-align: center; border-bottom: 8px solid #5E451D;">
					<h1 style="color: #000; margin: 0;">The Crunch Bistro & Sizzlers</h1>
					<p style="color: #5E451D; margin: 5px 0;">Employee Management System</p>
				</div>
				
				<div style="padding: 30px; background-color: #f9f9f9;">
					<h2 style="color: #28a745;">✅ Password Successfully Changed</h2>
					<p style="color: #666; line-height: 1.6;">
						Hello <strong>${fullname}</strong>,
					</p>
					<p style="color: #666; line-height: 1.6;">
						Your password has been successfully changed. You can now log in with your new password.
					</p>
					
					<div style="background-color: #d4edda; border-left: 4px solid #28a745; padding: 15px; margin: 20px 0;">
						<p style="margin: 0; color: #155724;">
							<strong>🔒 Security Tip:</strong> Keep your password safe and never share it with anyone.
						</p>
					</div>
					
					<p style="color: #666; line-height: 1.6;">
						If you did not make this change, please contact HR immediately.
					</p>
					
					<div style="text-align: center; margin: 30px 0;">
						<a href="${process.env.FRONTEND_URL4 || 'http://192.168.1.9:3001'}" 
						   style="display: inline-block; padding: 15px 30px; background-color: #000; 
								  color: #fff; text-decoration: none; border-radius: 5px; 
								  font-weight: bold; font-size: 16px;">
							Go to Login
						</a>
					</div>
				</div>
				
				<div style="background-color: #333; color: #fff; padding: 15px; text-align: center; font-size: 12px;">
					<p style="margin: 0;">© 2025 The Crunch Bistro & Sizzlers. All rights reserved.</p>
				</div>
			</div>
		`
	};
	await sendMailWithQueue(mail);
}

// ✅ Send deactivation email
export async function sendEmployeeDeactivatedEmail(to, fullname) {
	const mail = {
		from: `"The Crunch Bistro & Sizzlers" <${process.env.GMAIL_ADDRESS}>`,
		to,
		subject: "Your Account Has Been Deactivated",
		text: `Hello ${fullname},

We're informing you that your employee account has been deactivated.

If you believe this was a mistake or need further assistance, please contact HR.

– HR Department`,
	};
	await sendMailWithQueue(mail);
}

export async function sendDeactivationScheduledEmail(to, fullname, scheduleDate) {
    const formatted = DateTime.fromJSDate(scheduleDate)
        .setZone("Asia/Manila")
        .toFormat("MMMM dd, yyyy hh:mm a");

    const mail = {
        from: `"The Crunch Bistro & Sizzlers" <${process.env.GMAIL_ADDRESS}>`,
        to,
        subject: "Account Deactivation Scheduled",
        html: `
            <p>Hi ${fullname},</p>
            <p>Your employee account is scheduled for deactivation on:</p>
            <h3>${formatted}</h3>
            <p>If you believe this is a mistake, please contact HR immediately.</p>
            <br>
            <p>– HR Department</p>
        `
    };
    await sendMailWithQueue(mail);
}

export async function sendRestorationScheduledEmail(to, fullname, restorationDate) {
	const formatted = DateTime.fromJSDate(restorationDate).setZone("Asia/Manila")
		.toFormat("MMMM dd, yyyy hh:mm a");

	const mail = {
		from: `"The Crunch Bistro & Sizzlers" <${process.env.GMAIL_ADDRESS}>`,
		to,
		subject: "Your Account Reactivation Scheduled",
		html: `
			<p>Hi ${fullname},</p>
			<p>Your account is scheduled to be reactivated on:</p>
			<h3>${formatted}</h3>
			<p>If you have questions, contact HR immediately.</p>
		`
	};
	await sendMailWithQueue(mail);
}

// ✅ Send reactivation email
export async function sendEmployeeActivatedEmail(to, fullname) {
	const mail = {
		from: `"The Crunch Bistro & Sizzlers" <${process.env.GMAIL_ADDRESS}>`,
		to,
		subject: "Your Account Has Been Reactivated",
		text: `Hello ${fullname},

Good news! Your employee account has been successfully reactivated.
You can now log in again using your existing credentials.

Welcome back to the team!

– HR Department`,
	};
	await sendMailWithQueue(mail);
}

export async function sendAvailabilityReminderEmail(to, fullname) {
	const mail = {
		from: `"The Crunch BS" <${process.env.GMAIL_ADDRESS}>`,
		to,
		subject: "📅 Submit Your Availability for Next Week",
		html: `
			<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
				<h2 style="color: #FFC629;">Hi ${fullname}! 👋</h2>
				<p>This is a friendly reminder to submit your availability for next week's schedule.</p>
				
				<div style="background-color: #fff3cd; padding: 15px; border-radius: 5px; margin: 20px 0;">
					<strong>⏰ Deadline: Friday, 11:59 PM</strong>
				</div>
				
				<p>Please log in to your account and mark your available shifts:</p>
				<ul>
					<li><strong>Opening Shift:</strong> 9:00 AM - 2:00 PM</li>
					<li><strong>Closing Shift:</strong> 6:00 PM - 11:00 PM</li>
				</ul>
				
				<p>⚠️ Schedules will be finalized after the deadline. Any pending requests after Friday night will be automatically rejected.</p>
				
				<a href="${process.env.APP_URL || 'http://192.168.1.9:3001'}/employee/schedule" 
				   style="display: inline-block; background-color: #000; color: #fff; padding: 12px 24px; text-decoration: none; border-radius: 5px; margin: 20px 0;">
					Submit Availability Now
				</a>
				
				<p style="color: #666; font-size: 12px; margin-top: 30px;">
					If you have any questions, please contact HR.<br>
					– The Crunch BS Team
				</p>
			</div>
		`
	};
	await sendMailWithQueue(mail);
}

export async function sendScheduleFinalizedEmail(to, fullname, workDate, startTime, endTime) {
	const date = new Date(workDate);
	const formattedDate = date.toLocaleDateString("en-US", { 
		weekday: 'long', 
		year: 'numeric', 
		month: 'long', 
		day: 'numeric' 
	});
	
	const mail = {
		from: `"The Crunch BS" <${process.env.GMAIL_ADDRESS}>`,
		to,
		subject: "✅ Your Schedule Has Been Confirmed",
		html: `
			<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
				<h2 style="color: #FFC629;">Hi ${fullname}! 🎉</h2>
				<p>Good news! Your schedule for next week has been confirmed.</p>
				
				<div style="background-color: #d1f5cf; padding: 20px; border-radius: 5px; margin: 20px 0;">
					<h3 style="margin: 0 0 10px 0;">📅 Schedule Details</h3>
					<p style="margin: 5px 0;"><strong>Date:</strong> ${formattedDate}</p>
					<p style="margin: 5px 0;"><strong>Time:</strong> ${startTime} - ${endTime}</p>
				</div>
				
				<p>Please make sure to arrive on time. If you need to make any changes, contact your supervisor immediately.</p>
				
				<p style="color: #666; font-size: 12px; margin-top: 30px;">
					See you at work!<br>
					– The Crunch BS Team
				</p>
			</div>
		`
	};
	await sendMailWithQueue(mail);
}

export async function sendCertificateApprovedEmail(recipientEmail, recipientName, certificateId, pdfPath) {
    try {
        const mailOptions = {
            from: process.env.EMAIL_USER,
            to: recipientEmail,
            subject: '✅ Certificate of Employment - Approved',
            html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                    <div style="background-color: #4CAF50; color: white; padding: 20px; text-align: center;">
                        <h1 style="margin: 0;">Certificate Approved</h1>
                    </div>
                    
                    <div style="padding: 30px; background-color: #f9f9f9;">
                        <p style="font-size: 16px; color: #333;">
                            Dear <strong>${recipientName}</strong>,
                        </p>
                        
                        <p style="font-size: 14px; color: #666; line-height: 1.6;">
                            We are pleased to inform you that your Certificate of Employment request has been <strong>approved</strong>.
                        </p>
                        
                        <div style="background-color: white; padding: 20px; border-left: 4px solid #4CAF50; margin: 20px 0;">
                            <p style="margin: 0; font-size: 14px; color: #333;">
                                📄 Your certificate is attached to this email as a PDF document.
                            </p>
                        </div>
                        
                        <p style="font-size: 14px; color: #666;">
                            You can also download it anytime from the Employee Portal under <strong>Settings > Certificate of Employment</strong>.
                        </p>
                        
                        <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #ddd;">
                            <p style="font-size: 12px; color: #999; margin: 0;">
                                This is an automated message. Please do not reply to this email.
                            </p>
                        </div>
                    </div>
                    
                    <div style="background-color: #333; color: white; padding: 15px; text-align: center; font-size: 12px;">
                        <p style="margin: 0;">© 2025 The Crunch Business Solutions. All rights reserved.</p>
                    </div>
                </div>
            `,
            attachments: pdfPath ? [{
                filename: `Certificate_${certificateId}.pdf`,
                path: pdfPath
            }] : []
        };

        await transporter.sendMail(mailOptions);
        console.log(`✅ Certificate approval email sent to ${recipientEmail}`);
        return true;

    } catch (error) {
        console.error('❌ Failed to send certificate approval email:', error);
        return false;
    }
}

/**
 * Send certificate rejection notification
 */
export async function sendCertificateRejectedEmail(recipientEmail, recipientName, reason) {
    try {
        const mailOptions = {
            from: process.env.EMAIL_USER,
            to: recipientEmail,
            subject: '❌ Certificate of Employment - Request Update',
            html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                    <div style="background-color: #f44336; color: white; padding: 20px; text-align: center;">
                        <h1 style="margin: 0;">Certificate Request Update</h1>
                    </div>
                    
                    <div style="padding: 30px; background-color: #f9f9f9;">
                        <p style="font-size: 16px; color: #333;">
                            Dear <strong>${recipientName}</strong>,
                        </p>
                        
                        <p style="font-size: 14px; color: #666; line-height: 1.6;">
                            We regret to inform you that your Certificate of Employment request could not be processed at this time.
                        </p>
                        
                        ${reason ? `
                            <div style="background-color: #fff3cd; padding: 15px; border-left: 4px solid #ffc107; margin: 20px 0;">
                                <p style="margin: 0; font-size: 14px; color: #333;">
                                    <strong>Reason:</strong> ${reason}
                                </p>
                            </div>
                        ` : ''}
                        
                        <p style="font-size: 14px; color: #666;">
                            If you have any questions, please contact HR department.
                        </p>
                        
                        <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #ddd;">
                            <p style="font-size: 12px; color: #999; margin: 0;">
                                This is an automated message. Please do not reply to this email.
                            </p>
                        </div>
                    </div>
                    
                    <div style="background-color: #333; color: white; padding: 15px; text-align: center; font-size: 12px;">
                        <p style="margin: 0;">© 2025 The Crunch Business Solutions. All rights reserved.</p>
                    </div>
                </div>
            `
        };

        await transporter.sendMail(mailOptions);
        console.log(`✅ Certificate rejection email sent to ${recipientEmail}`);
        return true;

    } catch (error) {
        console.error('❌ Failed to send certificate rejection email:', error);
        return false;
    }
}

/**
 * Send new certificate request notification to admins
 */
export async function sendNewCertificateRequestEmail(adminEmail, employeeName, purpose) {
    try {
        const mailOptions = {
            from: process.env.EMAIL_USER,
            to: adminEmail,
            subject: '📋 New Certificate of Employment Request',
            html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                    <div style="background-color: #2196F3; color: white; padding: 20px; text-align: center;">
                        <h1 style="margin: 0;">New Certificate Request</h1>
                    </div>
                    
                    <div style="padding: 30px; background-color: #f9f9f9;">
                        <p style="font-size: 16px; color: #333;">
                            Dear Admin/HR,
                        </p>
                        
                        <p style="font-size: 14px; color: #666; line-height: 1.6;">
                            A new Certificate of Employment request has been submitted.
                        </p>
                        
                        <div style="background-color: white; padding: 20px; border-radius: 5px; margin: 20px 0;">
                            <p style="margin: 5px 0; font-size: 14px;">
                                <strong>Employee:</strong> ${employeeName}
                            </p>
                            <p style="margin: 5px 0; font-size: 14px;">
                                <strong>Purpose:</strong> ${purpose}
                            </p>
                        </div>
                        
                        <p style="font-size: 14px; color: #666;">
                            Please review and process this request in the admin portal.
                        </p>
                        
                        <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #ddd;">
                            <p style="font-size: 12px; color: #999; margin: 0;">
                                This is an automated message. Please do not reply to this email.
                            </p>
                        </div>
                    </div>
                    
                    <div style="background-color: #333; color: white; padding: 15px; text-align: center; font-size: 12px;">
                        <p style="margin: 0;">© 2025 The Crunch Business Solutions. All rights reserved.</p>
                    </div>
                </div>
            `
        };

        await transporter.sendMail(mailOptions);
        console.log(`✅ New certificate request email sent to ${adminEmail}`);
        return true;

    } catch (error) {
        console.error('❌ Failed to send new request email:', error);
        return false;
    }
}
// 🔹 Auto-detect internet and resend queued emails
let wasOffline = false;
setInterval(async () => {
	const online = await isOnline();
	if (online && wasOffline) {
		console.log("🌐 Internet reconnected — sending queued emails...");
		resendQueuedEmails();
	}
	wasOffline = !online ? true : false;
}, 5000);