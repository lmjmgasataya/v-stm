import { isKindFilter, KIND_FILTERS, type AttendanceRow } from "@/lib/attendance";
import { formatTime } from "@/lib/date";
import { memberDisplayName } from "@/lib/members";
import { parseSort, type SortDir } from "@/lib/sort";

// Filtering and sorting for the attendance tables (Sunday Attendance, Event Attendance) — shared
// by the pages and their Excel downloads, so a download matches what's on screen.

export const ATTENDANCE_COLUMNS = {
  name: "Name",
  ministry: "Ministry",
  service: "Service",
  time: "Check-in time",
  by: "Checked in by",
} as const;
export type AttendanceSort = keyof typeof ATTENDANCE_COLUMNS;

/** Sunday tables have a Service column; event tables don't. */
export const SUNDAY_SORTS: AttendanceSort[] = ["name", "ministry", "service", "time", "by"];
export const EVENT_SORTS: AttendanceSort[] = ["name", "ministry", "time", "by"];

export function parseAttendanceSort(sort: string | null | undefined, dir: string | null | undefined, sorts: AttendanceSort[]) {
  return parseSort(sort ?? undefined, dir ?? undefined, sorts, "name");
}

const byText = (a: string, b: string) => a.localeCompare(b, "en", { sensitivity: "base" });
const byName = (a: AttendanceRow, b: AttendanceRow) => byText(a.lastName, b.lastName) || byText(a.firstName, b.firstName);

const COMPARE: Record<AttendanceSort, (a: AttendanceRow, b: AttendanceRow) => number> = {
  name: byName,
  ministry: (a, b) => byText(a.ministries.join(", "), b.ministries.join(", ")) || byName(a, b),
  service: (a, b) => byText(a.service ?? "", b.service ?? "") || byName(a, b),
  time: (a, b) => a.checkedInAt.getTime() - b.checkedInAt.getTime() || byName(a, b),
  by: (a, b) => byText(a.checkedInBy ?? "", b.checkedInBy ?? "") || byName(a, b),
};

/** "" = everyone; a ministry = STMs in it; "leaders" / "staff" = those lists (events only) */
export function matchesFilter(r: AttendanceRow, filter: string) {
  if (!filter) return true;
  if (filter === "leaders") return r.kind === "leader";
  if (filter === "staff") return r.kind === "staff";
  return r.kind === "stm" && r.ministries.includes(filter);
}

export const filterLabel = (filter: string) => (isKindFilter(filter) ? KIND_FILTERS[filter] : filter);

/** The rows matching `filter`, sorted. */
export function prepareRows(rows: AttendanceRow[], filter: string, sort: AttendanceSort, dir: SortDir): AttendanceRow[] {
  const sign = dir === "asc" ? 1 : -1;
  return rows.filter((r) => matchesFilter(r, filter)).sort((a, b) => sign * COMPARE[sort](a, b));
}

/** "Dela Cruz, Juan P. (Jun)"; staff recorded without a last name show just their first name. */
export const attendanceName = (r: AttendanceRow) =>
  r.lastName ? memberDisplayName(r) : `${r.firstName}${r.nickname ? ` (${r.nickname})` : ""}`;

export const attendanceTime = (r: AttendanceRow) => formatTime(r.checkedInAt);
