import type { ExpenseEntry } from "../backend.d";
import { SHEETS } from "../hooks/useQueries";
import type { SheetConfigMap } from "../hooks/useSheetConfig";

type XLSXLib = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  utils: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  writeFile: (wb: any, filename: string) => void;
};

type WindowWithXLSX = Window & typeof globalThis & { XLSX?: XLSXLib };

// Dynamically load xlsx from CDN to avoid bundling it as an npm dependency
async function getXLSX(): Promise<XLSXLib> {
  const win = window as WindowWithXLSX;
  if (win.XLSX) {
    return win.XLSX;
  }
  return new Promise<XLSXLib>((resolve, reject) => {
    const script = document.createElement("script");
    script.src =
      "https://cdn.sheetjs.com/xlsx-latest/package/dist/xlsx.full.min.js";
    script.onload = () => {
      const loaded = (window as WindowWithXLSX).XLSX;
      if (loaded) {
        resolve(loaded);
      } else {
        reject(new Error("xlsx did not attach to window"));
      }
    };
    script.onerror = () => reject(new Error("Failed to load xlsx from CDN"));
    document.head.appendChild(script);
  });
}

export async function exportToXlsx(
  allEntries: ExpenseEntry[],
  year?: number,
  sheetConfigs?: SheetConfigMap,
) {
  const XLSX = await getXLSX();
  const wb = XLSX.utils.book_new();

  // ── Per-sheet tabs ──────────────────────────────────────────────────────────
  for (const sheet of SHEETS) {
    const sheetEntries = allEntries
      .filter(
        (e) => e.sheet === sheet && (!year || e.date.startsWith(String(year))),
      )
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

    // Use custom label if available, otherwise fall back to the internal key
    const tabLabel = sheetConfigs?.[sheet]?.label ?? sheet;
    // Excel sheet names max 31 chars
    XLSX.utils.book_append_sheet(wb, ws, tabLabel.slice(0, 31));
  }

  // ── Summary tab ─────────────────────────────────────────────────────────────
  // Collect all categories that appear in any entry for this year
  const filteredEntries = allEntries.filter(
    (e) => !year || e.date.startsWith(String(year)),
  );

  // Build a sorted list of all unique categories
  const categorySet = new Set<string>();
  for (const e of filteredEntries) {
    categorySet.add(e.category);
  }
  const categories = Array.from(categorySet).sort();

  // Build column headers: "Category" | Sheet1Label | Sheet2Label | ... | "Grand Total"
  const sheetLabels = SHEETS.map((s) =>
    (sheetConfigs?.[s]?.label ?? s).slice(0, 31),
  );
  const summaryHeader: string[] = ["Category", ...sheetLabels, "Grand Total"];
  const summaryRows: (string | number)[][] = [summaryHeader];

  for (const category of categories) {
    const row: (string | number)[] = [category];
    let rowTotal = 0;
    for (const sheet of SHEETS) {
      const total = filteredEntries
        .filter((e) => e.sheet === sheet && e.category === category)
        .reduce((sum, e) => sum + e.amount, 0);
      row.push(total);
      rowTotal += total;
    }
    row.push(rowTotal);
    summaryRows.push(row);
  }

  // Grand total row at the bottom
  const totalsRow: (string | number)[] = ["TOTAL"];
  let grandTotal = 0;
  for (const sheet of SHEETS) {
    const sheetTotal = filteredEntries
      .filter((e) => e.sheet === sheet)
      .reduce((sum, e) => sum + e.amount, 0);
    totalsRow.push(sheetTotal);
    grandTotal += sheetTotal;
  }
  totalsRow.push(grandTotal);
  summaryRows.push(totalsRow);

  const summaryWs = XLSX.utils.aoa_to_sheet(summaryRows);

  // Column widths for summary sheet
  summaryWs["!cols"] = [
    { wch: 36 }, // Category
    ...SHEETS.map(() => ({ wch: 16 })), // one per sheet
    { wch: 16 }, // Grand Total
  ];

  // Format all numeric cells as currency
  const summaryRange = XLSX.utils.decode_range(summaryWs["!ref"] ?? "A1");
  for (let r = 1; r <= summaryRange.e.r; r++) {
    for (let c = 1; c <= summaryRange.e.c; c++) {
      const cell = summaryWs[XLSX.utils.encode_cell({ r, c })];
      if (cell) {
        cell.z = '"$"#,##0.00';
      }
    }
  }

  XLSX.utils.book_append_sheet(wb, summaryWs, "Summary");

  const filename = year ? `house-expenses-${year}.xlsx` : "house-expenses.xlsx";
  XLSX.writeFile(wb, filename);
}
