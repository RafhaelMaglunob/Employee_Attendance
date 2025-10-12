// utils/checkDocuments.js
import { google } from "googleapis";

// Helper to check if a Google Drive file exists
async function fileExists(link, drive) {
  if (!link) return false;

  const match = link.match(/[-\w]{25,}/);
  if (!match) return false;

  const fileId = match[0];
  try {
    await drive.files.get({ fileId, fields: "id" });
    return true;
  } catch {
    return false;
  }
}

// Main checker function
export async function checkDocuments(pool) {
  // Setup Google Drive API auth
  const auth = new google.auth.GoogleAuth({
    scopes: ["https://www.googleapis.com/auth/drive.readonly"],
  });
  const drive = google.drive({ version: "v3", auth });

  const client = await pool.connect();
  try {
    const { rows } = await client.query("SELECT * FROM employee_documents");

    for (const doc of rows) {
      // Check each document field
      const checks = await Promise.all([
        fileExists(doc.sss_id, drive),
        fileExists(doc.resume_cv, drive),
        fileExists(doc.pagibig, drive),
        fileExists(doc.philhealth, drive),
        fileExists(doc.barangay_clearance, drive),
      ]);

      // All must exist to be "Complete"
      const newStatus = checks.every(Boolean) ? "Complete" : "Incomplete";

      // Update the database
      await client.query(
        "UPDATE employee_documents SET status = $1, updated_at = NOW() WHERE document_id = $2",
        [newStatus, doc.document_id]
      );

      console.log(`Employee ${doc.employee_id}: ${newStatus}`);
    }
  } catch (err) {
    console.error("❌ Document check failed:", err);
  } finally {
    client.release();
  }
}
