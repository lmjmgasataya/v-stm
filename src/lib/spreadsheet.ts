// Browser-only: reads an uploaded member list into rows of text cells.

import { parseCsv } from "@/lib/csv";

export const IMPORT_FILE_ACCEPT = ".csv,.tsv,.txt,.xlsx,text/csv,text/plain,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

const pad2 = (n: number) => String(n).padStart(2, "0");

/**
 * Excel stores dates as wall-clock serials, which read-excel-file turns into UTC Dates,
 * so the UTC parts are the wall time as typed (time-only cells sit on Excel's 1899-12-30 epoch).
 * Members have no date columns, but a stray date cell still comes through readable.
 */
function formatExcelDate(cell: Date): string {
  // Serials are floats: 2:30 PM can come back as 14:29:59.999
  const d = new Date(Math.round(cell.getTime() / 60_000) * 60_000);
  const time = `${pad2(d.getUTCHours())}:${pad2(d.getUTCMinutes())}`;
  if (d.getUTCFullYear() < 1900) return time;
  const date = `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}-${pad2(d.getUTCDate())}`;
  return d.getUTCHours() || d.getUTCMinutes() ? `${date} ${time}` : date;
}

/** First worksheet of an .xlsx, or CSV / tab-delimited text (.csv, .tsv, .txt). Blank rows are dropped. */
export async function readImportFile(file: File): Promise<string[][]> {
  if (!/\.xlsx$/i.test(file.name)) {
    if (/\.xls$/i.test(file.name)) throw new Error("Old .xls files aren't supported — open it in Excel and save as .xlsx or CSV.");
    return parseCsv(await file.text());
  }

  const { readSheet } = await import("read-excel-file/browser");
  // Numbers stay as written so mobile numbers don't turn into floats
  const data = await readSheet<string>(file, { parseNumber: (value) => value });
  return data
    .map((row) =>
      row.map((cell) => {
        if (cell === null) return "";
        if (cell instanceof Date) return formatExcelDate(cell);
        return String(cell).trim();
      })
    )
    .filter((row) => row.some((cell) => cell !== ""));
}
