import { NextResponse } from "next/server";
import writeXlsxFile, { type SheetData } from "write-excel-file/node";

// Shared by the Sunday and Event Attendance Excel downloads.

export const bold = (value: string) => ({ value, fontWeight: "bold" as const });
export const cell = (value: string | null | undefined) => ({ value: value ?? "" });

export async function xlsxResponse(sheet: SheetData, opts: { sheetName: string; widths: number[]; filename: string }) {
  const buffer = await writeXlsxFile(sheet, { sheet: opts.sheetName, columns: opts.widths.map((width) => ({ width })) }).toBuffer();
  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${opts.filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
