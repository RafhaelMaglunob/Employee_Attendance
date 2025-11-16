// utils/exportablePdf.js
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

export function exportTableToPdf(columns, data, fileName = "export.pdf") {
  const doc = new jsPDF();

  // Title
  doc.setFontSize(16);
  doc.text(fileName.replace(".pdf","").replace("_"," ").toUpperCase(), 14, 18);

  // Headers (skip action column)
  const headers = columns
    .filter(col => col.key !== "action")
    .map(col => col.title || col.key);

  // Rows
  const rows = data.map(row =>
    columns
      .filter(col => col.key !== "action")
      .map(col => {
        const value = row[col.dataIndex ?? col.key];

        if (value === null || value === undefined) return "";

        // Convert objects safely
        if (typeof value === "object") return JSON.stringify(value);

        return value.toString();
      })
  );

  // Generate table
  autoTable(doc, {
    startY: 26,
    head: [headers],
    body: rows,
    theme: "grid",
    headStyles: { fillColor: [0, 0, 0], textColor: 255 },
    styles: { fontSize: 10 }
  });

  // Save PDF
  doc.save(fileName);
}
