import { NextResponse, type NextRequest } from "next/server";
import writeXlsxFile, { type SheetData } from "write-excel-file/node";
import { getViewer } from "@/lib/access";
import { formatDateString, isDateString } from "@/lib/date";
import { getMinistryServiceTable } from "@/lib/reports";

/** Excel download of the Ministry × service report for `?date=` (the viewer's services only). */
export async function GET(req: NextRequest) {
  const viewer = await getViewer();
  if (!viewer) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const date = req.nextUrl.searchParams.get("date") ?? undefined;
  if (!isDateString(date)) return NextResponse.json({ error: "Pick a date" }, { status: 400 });
  const table = await getMinistryServiceTable(date, viewer.services);

  const bold = (value: string | number) => ({ value, fontWeight: "bold" as const });
  const num = (n: number) => ({ value: n, type: Number });
  const sheet: SheetData = [
    [bold(`STMs who served · ${formatDateString(date)}`)],
    [],
    [bold("Ministry"), ...table.services.map(bold), bold("Total")],
    ...table.rows.map((r) => [{ value: r.ministry }, ...r.counts.map(num), num(r.total)]),
    [bold("Total STMs"), ...table.serviceTotals.map(bold), bold(table.total)],
    [],
    [{ value: "Someone in several ministries counts in each row; totals count each person once." }],
  ];

  const buffer = await writeXlsxFile(sheet, {
    sheet: date,
    columns: [{ width: 18 }, ...table.services.map(() => ({ width: 18 })), { width: 10 }],
  }).toBuffer();

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="stm-ministry-by-service-${date}.xlsx"`,
      "Cache-Control": "no-store",
    },
  });
}
