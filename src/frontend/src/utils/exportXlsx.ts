import * as XLSX from "xlsx";
import type { ExpenseEntry } from "../backend.d";
import { SHEETS } from "../hooks/useQueries";

export function exportToXlsx(allEntries: ExpenseEntry[]) {
  const wb = XLSX.utils.book_new();

  for (const sheet of SHEETS) {
    const sheetEntries = allEntries
      .filter((e) => e.sheet === sheet)
      .sort((a, b) => a.date.localeCompare(b.date));

    const rows: (string | number)[][] = [
      ["Date", "Company", "Category", "Amount", "Notes"],
    ];

    for (const entry of sheetEntries) {
      rows.push([
        entry.date,
        entry.companyName,
        entry.category,
        entry.amount,
        entry.notes,
      ]);
    }

    const ws = XLSX.utils.aoa_to_sheet(rows);

    // Column widths
    ws["!cols"] = [
      { wch: 14 }, // Date
      { wch: 28 }, // Company
      { wch: 22 }, // Category
      { wch: 12 }, // Amount
      { wch: 35 }, // Notes
    ];

    // Format amount column as currency
    const range = XLSX.utils.decode_range(ws["!ref"] ?? "A1");
    for (let r = 1; r <= range.e.r; r++) {
      const cell = ws[XLSX.utils.encode_cell({ r, c: 3 })];
      if (cell) {
        cell.z = '"$"#,##0.00';
      }
    }

    XLSX.utils.book_append_sheet(wb, ws, sheet);
  }

  XLSX.writeFile(wb, "house-expenses.xlsx");
}
