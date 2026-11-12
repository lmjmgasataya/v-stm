import { requireViewer } from "@/lib/access";
import { getAttendanceByService, getCheckInCountsByDate, getRecentServiceDates, type AttendanceRow } from "@/lib/attendance";
import { MINISTRY_OPTIONS } from "@/lib/constants";
import { addMonths, formatDateString, isDateString, isMonthString, manilaDateString } from "@/lib/date";
import { parseSort } from "@/lib/sort";
import { StatCard } from "@/components/StatCard";
import { AttendanceCalendar } from "./AttendanceCalendar";
import {
  AttendanceCard,
  COMPARE,
  FilterChips,
  RecentDates,
  SORT_KEYS,
  SortChips,
  attendanceHref,
  filterLabel,
  matchesFilter,
} from "./AttendanceParts";

/** Sunday service check-ins only — events have their own page (/event-attendance). */
export default async function AttendancePage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string; month?: string; ministry?: string; sort?: string; dir?: string }>;
}) {
  const viewer = await requireViewer();

  const sp = await searchParams;
  const today = manilaDateString();
  const date = isDateString(sp.date) ? sp.date : today;
  // ?month= only while browsing the calendar; otherwise show the selected date's month
  const month = isMonthString(sp.month) ? sp.month : date.slice(0, 7);
  const lastOfMonth = new Date(`${addMonths(month, 1)}-01T00:00:00Z`).getTime() - 24 * 60 * 60 * 1000;
  const ministry = (MINISTRY_OPTIONS as readonly string[]).includes(sp.ministry ?? "") ? sp.ministry! : "";
  const { sort, dir } = parseSort(sp.sort, sp.dir, SORT_KEYS, "last");

  const current = { date, ministry, sort, dir };
  const href = (next: Parameters<typeof attendanceHref>[2]) => attendanceHref("/attendance", current, next);
  const keep = href({}).replace(/^\/attendance\?date=[^&]*/, ""); // "&ministry=…&sort=…" for the calendar

  const [services, recentDates, calendarCounts] = await Promise.all([
    getAttendanceByService(date, viewer.services),
    getRecentServiceDates(viewer.services, ministry || undefined),
    getCheckInCountsByDate(`${month}-01`, new Date(lastOfMonth).toISOString().slice(0, 10), viewer.services, ministry || undefined),
  ]);

  const all = services.flatMap((s) => s.rows);
  // A member serving in several ministries counts once in each (always over the whole day, so
  // every chip shows its own count even while another ministry is selected)
  const ministryCounts = MINISTRY_OPTIONS.map((m) => ({
    value: m,
    label: m,
    count: new Set(all.filter((r) => matchesFilter(r, m)).map((r) => r.key)).size,
  }));
  const allMembers = new Set(all.map((r) => r.key)).size;

  const sign = dir === "asc" ? 1 : -1;
  const prepare = (rows: AttendanceRow[]) => rows.filter((r) => matchesFilter(r, ministry)).sort((a, b) => sign * COMPARE[sort](a, b));
  const serviceCards = services.map(({ service, rows }) => ({ service, rows: prepare(rows) }));
  const shownAll = serviceCards.flatMap((s) => s.rows);
  const uniqueMembers = new Set(shownAll.map((r) => r.key)).size;
  const filterNote = ministry ? `${filterLabel(ministry)} only` : undefined;

  return (
    <div className="flex flex-col gap-6">
      {/* Phones: title, calendar, stats. Wider: calendar on the right of both. */}
      <div className="grid gap-6 sm:grid-cols-[1fr_auto] content-start">
        <div className="sm:col-start-1">
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-stone-900">
            Sunday Attendance{viewer.serviceGroup && ` · ${viewer.serviceGroup}`}
          </h1>
          <p className="text-sm text-stone-500">{formatDateString(date)}</p>
        </div>

        <div className="sm:col-start-2 sm:row-start-1 sm:row-span-2">
          <AttendanceCalendar month={month} selected={date} today={today} counts={calendarCounts} keep={keep} />
        </div>

        <div className="sm:col-start-1 flex flex-col gap-6 min-w-0">
          <RecentDates dates={recentDates} selected={date} href={(d) => href({ date: d })} />

          <div className="grid gap-4 grid-cols-2">
            <StatCard label="Check-ins" value={shownAll.length} hint={filterNote} />
            <StatCard label="Members served" value={uniqueMembers} hint={filterNote ?? "Counted once across services"} />
          </div>

          <FilterChips allCount={allMembers} items={ministryCounts} selected={ministry} href={(m) => href({ ministry: m })} />
        </div>
      </div>

      <SortChips sort={sort} dir={dir} href={(s, d) => href({ sort: s, dir: d })} />

      <div className="grid gap-4 lg:grid-cols-2">
        {serviceCards.map((card) => (
          <AttendanceCard key={card.service} title={card.service} rows={card.rows} filter={ministry} sort={sort} />
        ))}
      </div>
    </div>
  );
}
