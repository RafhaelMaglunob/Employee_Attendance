// utils/exportWord.js
import { Document, Packer, Paragraph, Table, TableCell, TableRow, WidthType } from "docx";
import { saveAs } from "file-saver";

export async function exportTableToWord(columns, data, fileName = "export.docx") {
    // Header row
    const headerRow = new TableRow({
        children: columns.map(col =>
            new TableCell({
                width: { size: 25, type: WidthType.PERCENTAGE },
                children: [new Paragraph({ text: col.title || col, bold: true })],
            })
        ),
    });

    // Data rows
    const dataRows = data.map(row =>
        new TableRow({
            children: columns.map(col =>
                new TableCell({
                    width: { size: 25, type: WidthType.PERCENTAGE },
                    children: [new Paragraph({ text: row[col.key] || "" })],
                })
            ),
        })
    );

    const table = new Table({
        rows: [headerRow, ...dataRows],
        width: { size: 100, type: WidthType.PERCENTAGE },
    });

    const doc = new Document({
        sections: [
            {
                properties: {},
                children: [
                    new Paragraph({ text: "Audit Logs", heading: "Heading1" }),
                    table,
                ],
            },
        ],
    });

    const blob = await Packer.toBlob(doc);
    saveAs(blob, fileName);
}
