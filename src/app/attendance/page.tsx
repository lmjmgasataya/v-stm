import { requireViewer } from "@/lib/access";
import { getAttendanceByService, getCheckInCountsByDate } from "@/lib/attendance";
import { SUNDAY_SORTS, attendanceName, filterLabel, matchesFilter, parseAttendanceSort, prepareRows } from "@/lib/attendance-table";
import { MINISTRY_OPTIONS } from "@/lib/constants";
import { addMonths, formatDateString, isDateString, isMonthString, manilaDateString } from "@/lib/date";
import { StatCard } from "@/components/StatCard";
import { secondaryBtnCls } from "@/components/form";
import { AddCheckInButton } from "./AddCheckInButton";
import { AttendanceMonthNav } from "./AttendanceMonthNav";
import { AttendanceTable, FilterChips, ServiceCards, attendanceHref, type AttendanceParams } from "./AttendanceParts";
import { RemoveCheckInButton } from "./RemoveCheckInButton";

/** Sunday service check-ins only — events have their own page (/event-attendance). */
export default async function AttendancePage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string; month?: string; ministry?: string; service?: string; sort?: string; dir?: string }>;
}) {
  const viewer = await requireViewer();

  const sp = await searchParams;
  const today = manilaDateString();
  const currentMonth = today.slice(0, 7);
  const requested = isDateString(sp.date) ? sp.date : undefined;
  // ?month= while browsing months; else the requested date's month; else this month
  const month = isMonthString(sp.month) ? sp.month : (requested?.slice(0, 7) ?? currentMonth);
  const lastOfMonth = new Date(new Date(`${addMonths(month, 1)}-01T00:00:00Z`).getTime() - 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const ministry = (MINISTRY_OPTIONS as readonly string[]).includes(sp.ministry ?? "") ? sp.ministry! : "";
  const service = viewer.services.includes(sp.service ?? "") ? sp.service! : "";
  const { sort, dir } = parseAttendanceSort(sp.sort, sp.dir, SUNDAY_SORTS);

  // One card per date in the month with check-ins (in the viewer's services, whatever the filters)
  const counts = await getCheckInCountsByDate(`${month}-01`, lastOfMonth, viewer.services);
  const monthDates = Array.from(counts, ([d, total]) => ({ date: d, total })).sort((a, b) => a.date.localeCompare(b.date));
  // The requested date when it's in this month (even with no check-ins yet, e.g. right after
  // adding one to an empty Sunday), else the month's latest date with check-ins
  const date = requested?.startsWith(month) ? requested : monthDates.at(-1)?.date;
  if (date && !counts.has(date)) {
    monthDates.push({ date, total: 0 });
    monthDates.sort((a, b) => a.date.localeCompare(b.date));
  }

  const current: AttendanceParams = { date: date ?? today, ministry, service, sort, dir };
  const href = (next: Partial<AttendanceParams>) => attendanceHref("/attendance", current, next);
  const keep = href({}).replace(/^\/attendance\?date=[^&]*/, ""); // "&ministry=…&sort=…" for the month nav

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-stone-900">
            Sunday Attendance{viewer.serviceGroup && ` · ${viewer.serviceGroup}`}
          </h1>
          {date && <p className="text-sm text-stone-500">{formatDateString(date)}</p>}
        </div>
        {/* Anyone can fix attendance afterwards (within their services): add a missed check-in, remove a wrong one */}
        <AddCheckInButton key={`${date}|${service}`} date={date ?? today} today={today} services={viewer.services} defaultService={service} />
      </div>

      <AttendanceMonthNav month={month} currentMonth={currentMonth} dates={monthDates} selected={date} keep={keep}>
        {date && (
          <DayAttendance date={date} today={today} services={viewer.services} ministry={ministry} service={service} current={current} href={href} />
        )}
      </AttendanceMonthNav>
    </div>
  );
}

async function DayAttendance({
  date,
  today,
  services: viewerServices,
  ministry,
  service,
  current,
  href,
}: {
  date: string;
  today: string;
  services: readonly string[];
  ministry: string;
  service: string;
  current: AttendanceParams;
  href: (next: Partial<AttendanceParams>) => string;
}) {
  const { sort, dir } = current;
  const services = await getAttendanceByService(date, viewerServices);

  const all = services.flatMap((s) => s.rows);
  // Service cards follow the ministry filter
  const serviceCounts = services.map((s) => ({ service: s.service, count: s.rows.filter((r) => matchesFilter(r, ministry)).length }));

  const rows = prepareRows(service ? all.filter((r) => r.service === service) : all, ministry, sort, dir);
  const uniqueMembers = new Set(rows.map((r) => r.key)).size;
  const filterNote = [ministry && filterLabel(ministry), service].filter(Boolean).join(" · ") || undefined;
  const canEdit = date <= today;

  return (
    <>
      <div className="grid gap-4 grid-cols-2">
        <StatCard label="Check-ins" value={rows.length} hint={filterNote} />
        <StatCard label="Members served" value={uniqueMembers} hint={filterNote ?? "Counted once across services"} />
      </div>

      <FilterChips items={MINISTRY_OPTIONS.map((m) => ({ value: m, label: m }))} selected={ministry} href={(m) => href({ ministry: m })} />
      <ServiceCards services={serviceCounts} selected={service} href={(s) => href({ service: s })} />

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
        <AttendanceTable
          rows={rows}
          filter={ministry}
          sort={sort}
          dir={dir}
          columns={SUNDAY_SORTS}
          rowAction={
            canEdit
              ? (r) =>
                  r.memberId !== undefined &&
                  r.service && <RemoveCheckInButton memberId={r.memberId} date={date} service={r.service} name={attendanceName(r)} />
              : undefined
          }
        />
      </div>
    </>
  );
}
