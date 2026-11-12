import { requireViewer } from "@/lib/access";
import { getAttendanceByService, getCheckInCountsByDate, getRecentServiceDates } from "@/lib/attendance";
import { SUNDAY_SORTS, filterLabel, matchesFilter, parseAttendanceSort, prepareRows } from "@/lib/attendance-table";
import { MINISTRY_OPTIONS } from "@/lib/constants";
import { addMonths, formatDateString, isDateString, isMonthString, manilaDateString } from "@/lib/date";
import { StatCard } from "@/components/StatCard";
import { secondaryBtnCls } from "@/components/form";
import { AttendanceCalendar } from "./AttendanceCalendar";
import { AttendanceTable, FilterChips, RecentDates, ServiceCards, attendanceHref, type AttendanceParams } from "./AttendanceParts";

/** Sunday service check-ins only — events have their own page (/event-attendance). */
export default async function AttendancePage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string; month?: string; ministry?: string; service?: string; sort?: string; dir?: string }>;
}) {
  const viewer = await requireViewer();

  const sp = await searchParams;
  const today = manilaDateString();
  const date = isDateString(sp.date) ? sp.date : today;
  // ?month= only while browsing the calendar; otherwise show the selected date's month
  const month = isMonthString(sp.month) ? sp.month : date.slice(0, 7);
  const lastOfMonth = new Date(`${addMonths(month, 1)}-01T00:00:00Z`).getTime() - 24 * 60 * 60 * 1000;
  const ministry = (MINISTRY_OPTIONS as readonly string[]).includes(sp.ministry ?? "") ? sp.ministry! : "";
  const service = viewer.services.includes(sp.service ?? "") ? sp.service! : "";
  const { sort, dir } = parseAttendanceSort(sp.sort, sp.dir, SUNDAY_SORTS);

  const current: AttendanceParams = { date, ministry, service, sort, dir };
  const href = (next: Partial<AttendanceParams> & { month?: string }) => attendanceHref("/attendance", current, next);
  const keep = href({}).replace(/^\/attendance\?date=[^&]*/, ""); // "&ministry=…&sort=…" for the calendar

  const [services, recentDates, calendarCounts] = await Promise.all([
    getAttendanceByService(date, viewer.services),
    getRecentServiceDates(viewer.services, ministry || undefined),
    getCheckInCountsByDate(`${month}-01`, new Date(lastOfMonth).toISOString().slice(0, 10), viewer.services, ministry || undefined),
  ]);

  const all = services.flatMap((s) => s.rows);
  // Ministry chips count people over the whole day (every chip keeps its own count while another is selected)
  const ministryCounts = MINISTRY_OPTIONS.map((m) => ({
    value: m,
    label: m,
    count: new Set(all.filter((r) => matchesFilter(r, m)).map((r) => r.key)).size,
  }));
  const allMembers = new Set(all.map((r) => r.key)).size;
  // Service cards follow the ministry filter
  const serviceCounts = services.map((s) => ({ service: s.service, count: s.rows.filter((r) => matchesFilter(r, ministry)).length }));

  const rows = prepareRows(service ? all.filter((r) => r.service === service) : all, ministry, sort, dir);
  const uniqueMembers = new Set(rows.map((r) => r.key)).size;
  const filterNote = [ministry && filterLabel(ministry), service].filter(Boolean).join(" · ") || undefined;

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
            <StatCard label="Check-ins" value={rows.length} hint={filterNote} />
            <StatCard label="Members served" value={uniqueMembers} hint={filterNote ?? "Counted once across services"} />
          </div>

          <FilterChips allCount={allMembers} items={ministryCounts} selected={ministry} href={(m) => href({ ministry: m })} />
          <ServiceCards services={serviceCounts} selected={service} href={(s) => href({ service: s })} />
        </div>
      </div>

      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-stone-500">
            Check-ins{filterNote && <span className="normal-case tracking-normal font-normal"> · {filterNote}</span>}
          </h2>
          <a
            href={attendanceHref("/attendance/export", current)}
            download
            aria-disabled={rows.length === 0}
            className={`${secondaryBtnCls} ${rows.length === 0 ? "pointer-events-none opacity-50" : ""}`}
          >
            Download Excel
          </a>
        </div>
        <AttendanceTable rows={rows} filter={ministry} sort={sort} dir={dir} columns={SUNDAY_SORTS} />
      </div>
    </div>
  );
}
