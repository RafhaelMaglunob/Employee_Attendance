// utils/exportPdf.js
import jsPDF from "jspdf";
import "jspdf-autotable";

export function exportTableToPdf(columns, data, fileName = "export.pdf") {
  const doc = new jsPDF();

  // Add title
  doc.setFontSize(18);
  doc.text("Audit Logs", 14, 22);

  // Prepare table headers
  const headers = columns.map(col => col.title || col);

  // Prepare table rows
  const rows = data.map(row => columns.map(col => row[col.key] || ""));

  // Add table
  doc.autoTable({
    startY: 30,
    head: [headers],
    body: rows,
    theme: "grid",
    headStyles: { fillColor: [50, 50, 50], textColor: 255 },
    styles: { fontSize: 10 },
  });

  doc.save(fileName);
}
