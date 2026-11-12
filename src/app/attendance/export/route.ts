import { NextResponse, type NextRequest } from "next/server";
import { getViewer } from "@/lib/access";
import { getAttendanceByService } from "@/lib/attendance";
import { bold, cell, xlsxResponse } from "@/lib/attendance-export";
import { SUNDAY_SORTS, attendanceName, attendanceTime, filterLabel, parseAttendanceSort, prepareRows } from "@/lib/attendance-table";
import { MINISTRY_OPTIONS } from "@/lib/constants";
import { formatDateString, isDateString } from "@/lib/date";

/** Excel download of Sunday Attendance for `?date=` — same ministry/service filter and sort as the page, the viewer's services only. */
export async function GET(req: NextRequest) {
  const viewer = await getViewer();
  if (!viewer) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const q = req.nextUrl.searchParams;
  const date = q.get("date") ?? undefined;
  if (!isDateString(date)) return NextResponse.json({ error: "Pick a date" }, { status: 400 });
  const ministry = (MINISTRY_OPTIONS as readonly string[]).includes(q.get("ministry") ?? "") ? q.get("ministry")! : "";
  const service = viewer.services.includes(q.get("service") ?? "") ? q.get("service")! : "";
  const { sort, dir } = parseAttendanceSort(q.get("sort"), q.get("dir"), SUNDAY_SORTS);

  const all = (await getAttendanceByService(date, viewer.services)).flatMap((s) => s.rows);
  const rows = prepareRows(service ? all.filter((r) => r.service === service) : all, ministry, sort, dir);
  const filters = [ministry && filterLabel(ministry), service].filter(Boolean).join(" · ");

  return xlsxResponse(
    [
      [bold(`Sunday Attendance · ${formatDateString(date)}${filters ? ` · ${filters}` : ""}`)],
      [],
      [bold("Name"), bold("Ministry"), bold("Service"), bold("Check-in time"), bold("Checked in by")],
      ...rows.map((r) => [cell(attendanceName(r)), cell(r.ministries.join(", ")), cell(r.service), cell(attendanceTime(r)), cell(r.checkedInBy)]),
      [],
      [bold(`${rows.length} check-ins · ${new Set(rows.map((r) => r.key)).size} members`)],
    ],
    { sheetName: date, widths: [34, 18, 20, 14, 24], filename: `stm-sunday-attendance-${date}.xlsx` }
  );
}
