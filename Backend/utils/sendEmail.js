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

	await transporter.sendMail(mail);
	console.log(`✅ Email sent to ${mail.to}`);
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
		from: `"Your Company" <${process.env.GMAIL_ADDRESS}>`,
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

// ✅ NEW: Send deactivation email
export async function sendEmployeeDeactivatedEmail(to, fullname) {
	const mail = {
		from: `"Your Company" <${process.env.GMAIL_ADDRESS}>`,
		to,
		subject: "Your Account Has Been Deactivated",
		text: `Hello ${fullname},

We’re informing you that your employee account has been deactivated.

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
        from: `"Your Company" <${process.env.GMAIL_ADDRESS}>`,
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

    // ✅ This uses your queue & connection-check system
    await sendMailWithQueue(mail);
}

export async function sendRestorationScheduledEmail(to, fullname, restorationDate) {
	const formatted = DateTime.fromJSDate(restorationDate).setZone("Asia/Manila")
		.toFormat("MMMM dd, yyyy hh:mm a");

	const mail = {
		from: `"Your Company" <${process.env.GMAIL_ADDRESS}>`,
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

// ✅ NEW: Send reactivation email
export async function sendEmployeeActivatedEmail(to, fullname) {
	const mail = {
		from: `"Your Company" <${process.env.GMAIL_ADDRESS}>`,
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
				
				<a href="${process.env.APP_URL || 'http://192.168.1.9:3000'}/employee/schedule" 
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
