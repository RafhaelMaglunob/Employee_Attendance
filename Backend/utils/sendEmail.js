import nodemailer from "nodemailer";
import fs from "fs";
import path from "path";
import dns from "dns";


const QUEUE_FILE = path.resolve("./emailQueue.json");

function saveToQueue(emailData) {
    let queue = [];
    if (fs.existsSync(QUEUE_FILE)) {
        queue = JSON.parse(fs.readFileSync(QUEUE_FILE, "utf-8"));
    }
    queue.push(emailData);
    fs.writeFileSync(QUEUE_FILE, JSON.stringify(queue, null, 2));
}

function isOnline() {
    return new Promise((resolve) => {
        dns.lookup("google.com", (err) => resolve(!err));
    });
}

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

export async function sendEmployeeEmail(to, fullname, tempPassword) {
    const mail = {
        from: `"Your Company" <${process.env.GMAIL_ADDRESS}>`,
        to,
        subject: "Your temporary account password",
        text: `Hello ${fullname},

Your Email is: ${to}
Your temporary password is: ${tempPassword}

For security, this password will expire on first use. Please sign in and change your password immediately.`,
    };

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

// 👇 Auto-detect when internet is back
let wasOffline = false;
setInterval(async () => {
    const online = await isOnline();
    if (online && wasOffline) {
        console.log("🌐 Internet reconnected — sending queued emails...");
        resendQueuedEmails();
    }
    wasOffline = !online ? true : false;
}, 5000); // checks every 5 seconds, light and low-cost
