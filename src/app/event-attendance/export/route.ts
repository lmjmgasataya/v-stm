import { NextResponse, type NextRequest } from "next/server";
import { getViewer } from "@/lib/access";
import { getEventAttendance, isKindFilter } from "@/lib/attendance";
import { bold, cell, xlsxResponse } from "@/lib/attendance-export";
import { EVENT_SORTS, attendanceName, attendanceTime, filterLabel, parseAttendanceSort, prepareRows } from "@/lib/attendance-table";
import { MINISTRY_OPTIONS } from "@/lib/constants";
import { formatDateString, isDateString } from "@/lib/date";

const KIND_LABELS = { stm: "STM", leader: "Leader", staff: "Pastor/Staff" } as const;

/** Excel download of Event Attendance for `?date=` — every event that day, same filter and sort as the page. Church-wide. */
export async function GET(req: NextRequest) {
  const viewer = await getViewer();
  if (!viewer) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const q = req.nextUrl.searchParams;
  const date = q.get("date") ?? undefined;
  if (!isDateString(date)) return NextResponse.json({ error: "Pick a date" }, { status: 400 });
  const raw = q.get("ministry") ?? "";
  const filter = (MINISTRY_OPTIONS as readonly string[]).includes(raw) || isKindFilter(raw) ? raw : "";
  const { sort, dir } = parseAttendanceSort(q.get("sort"), q.get("dir"), EVENT_SORTS);

  const events = (await getEventAttendance(date)).map(({ event, rows }) => ({ event, rows: prepareRows(rows, filter, sort, dir) }));
  const walkInColumn = events.some((e) => e.event.preRegistration);
  const total = events.reduce((n, e) => n + e.rows.length, 0);

  return xlsxResponse(
    [
      [bold(`Event Attendance · ${formatDateString(date)}${filter ? ` · ${filterLabel(filter)}` : ""}`)],
      [],
      [bold("Event"), bold("Name"), bold("Type"), bold("Ministry"), ...(walkInColumn ? [bold("Walk-in")] : []), bold("Check-in time"), bold("Checked in by")],
      ...events.flatMap(({ event, rows }) =>
        rows.map((r) => [
          cell(event.name),
          cell(attendanceName(r)),
          cell(KIND_LABELS[r.kind]),
          cell(r.ministries.join(", ")),
          ...(walkInColumn ? [cell(r.isWalkIn ? "Yes" : "")] : []),
          cell(attendanceTime(r)),
          cell(r.checkedInBy),
        ])
      ),
      [],
      [bold(`${total} check-ins`)],
    ],
    {
      sheetName: date,
      widths: [36, 34, 12, 18, ...(walkInColumn ? [9] : []), 14, 24],
      filename: `stm-event-attendance-${date}.xlsx`,
    }
  );
}
