import Link from "next/link";
import type { AttendanceRow } from "@/lib/attendance";
import { ATTENDANCE_COLUMNS, attendanceName, attendanceTime, filterLabel, type AttendanceSort } from "@/lib/attendance-table";
import type { SortDir } from "@/lib/sort";
import { SortableTh } from "@/components/SortableTh";

// Shared by Sunday Attendance (/attendance) and Event Attendance (/event-attendance).

const pillCls = (active: boolean) =>
  `rounded-full px-3 py-1 text-xs font-semibold transition ${
    active ? "bg-stm-brand text-white" : "bg-white text-stone-600 ring-1 ring-stone-200 hover:ring-stm-brand/40 hover:text-stm-brand"
  }`;

const chipCls = (active: boolean) =>
  `rounded-lg border px-3 py-1.5 text-sm transition ${
    active ? "border-stm-brand bg-stm-brand text-white" : "border-stone-200 bg-white hover:border-stm-brand/40"
  }`;

export function RecentDates({
  dates,
  selected,
  href,
  label = "Recent:",
}: {
  dates: { date: string; total: number }[];
  selected: string;
  href: (date: string) => string;
  label?: string;
}) {
  if (dates.length === 0) return null;
  return (
    <div className="flex flex-wrap items-center gap-2 text-sm">
      <span className="text-stone-500">{label}</span>
      {dates.map((d) => (
        <Link key={d.date} href={href(d.date)} className={pillCls(d.date === selected)}>
          {d.date} · {d.total}
        </Link>
      ))}
    </div>
  );
}

/** Filter chips that double as counts. Clicking the selected chip again clears the filter. */
export function FilterChips({
  allCount,
  items,
  selected,
  href,
}: {
  allCount: number;
  items: { value: string; label: React.ReactNode; count: number }[];
  selected: string;
  href: (value: string) => string;
}) {
  return (
    <section>
      <h2 className="text-sm font-semibold uppercase tracking-wide text-stone-500 mb-3">Filter</h2>
      <div className="flex flex-wrap gap-2">
        <Link href={href("")} replace scroll={false} className={chipCls(!selected)} aria-current={!selected || undefined}>
          All <span className={`font-bold ${selected ? "text-stm-brand" : ""}`}>{allCount}</span>
        </Link>
        {items.map(({ value, label, count }) => {
          const active = value === selected;
          return (
            <Link
              key={value}
              href={href(active ? "" : value)}
              replace
              scroll={false}
              aria-current={active || undefined}
              className={chipCls(active)}
            >
              <span className={active ? "" : "text-stone-600"}>{label}</span>{" "}
              <span className={`font-bold ${active ? "" : "text-stm-brand"}`}>{count}</span>
            </Link>
          );
        })}
      </div>
    </section>
  );
}

const KIND_BADGES: Partial<Record<AttendanceRow["kind"], string>> = { leader: "Leader", staff: "Pastor/Staff" };

/**
 * Check-ins as a full-width table with sortable headers (`?sort=&dir=`, via SortableTh, so
 * sorting keeps the date and filters). Optional title bar for one event or service.
 */
export function AttendanceTable({
  title,
  href,
  rows,
  filter,
  sort,
  dir,
  columns,
}: {
  title?: string;
  href?: string;
  rows: AttendanceRow[];
  filter: string;
  sort: AttendanceSort;
  dir: SortDir;
  columns: AttendanceSort[];
}) {
  const walkIns = rows.filter((r) => r.isWalkIn).length;
  const td = "px-4 py-2.5";
  return (
    <section className="bg-white rounded-2xl border border-stone-200/80 shadow-sm overflow-hidden">
      {title && (
        <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-stone-100">
          <h2 className="font-semibold text-stone-900">
            {href ? (
              <Link href={href} className="hover:text-stm-brand hover:underline">
                {title}
              </Link>
            ) : (
              title
            )}
          </h2>
          <span className="text-sm font-bold text-stm-green whitespace-nowrap">
            {rows.length} checked in
            {walkIns > 0 && <span className="font-medium text-stm-amber"> · {walkIns} walk-ins</span>}
          </span>
        </div>
      )}
      {rows.length === 0 ? (
        <p className="px-4 py-4 text-sm text-stone-400">{filter ? `No ${filterLabel(filter)} check-ins.` : "No check-ins."}</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[44rem] text-sm">
            <thead>
              <tr className="border-b border-stone-200 bg-stone-50 text-left text-xs text-stone-500">
                {columns.map((c) => (
                  <SortableTh key={c} column={c} label={ATTENDANCE_COLUMNS[c]} sort={sort} dir={dir} />
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {rows.map((r) => (
                <tr key={`${r.key}-${r.service ?? ""}`} className="hover:bg-stone-50/60">
                  {columns.map((c) => {
                    switch (c) {
                      case "name":
                        return (
                          <td key={c} className={`${td} font-medium text-stone-900`}>
                            {attendanceName(r)}
                            {KIND_BADGES[r.kind] && (
                              <span className="ml-2 rounded-full bg-stm-brand/10 px-2 py-0.5 text-[11px] font-semibold text-stm-brand align-middle">
                                {KIND_BADGES[r.kind]}
                              </span>
                            )}
                            {r.isWalkIn && (
                              <span className="ml-2 rounded-full bg-stm-amber/15 px-2 py-0.5 text-[11px] font-semibold text-stm-amber align-middle">
                                Walk-in
                              </span>
                            )}
                          </td>
                        );
                      case "ministry":
                        return <td key={c} className={`${td} text-stone-600`}>{r.ministries.join(", ") || <span className="text-stone-400">—</span>}</td>;
                      case "service":
                        return <td key={c} className={`${td} text-stone-600 whitespace-nowrap`}>{r.service}</td>;
                      case "time":
                        return <td key={c} className={`${td} text-stone-600 whitespace-nowrap tabular-nums`}>{attendanceTime(r)}</td>;
                      case "by":
                        return <td key={c} className={`${td} text-stone-600`}>{r.checkedInBy ?? <span className="text-stone-400">—</span>}</td>;
                    }
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

/** Sunday: check-ins per service as cards that double as a filter (click again to clear). */
export function ServiceCards({
  services,
  selected,
  href,
}: {
  services: { service: string; count: number }[];
  selected: string;
  href: (service: string) => string;
}) {
  return (
    <section>
      <h2 className="text-sm font-semibold uppercase tracking-wide text-stone-500 mb-3">Services</h2>
      <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 xl:grid-cols-4">
        {services.map(({ service, count }) => {
          const active = service === selected;
          const [time, place] = service.split(" - ");
          return (
            <Link
              key={service}
              href={href(active ? "" : service)}
              replace
              scroll={false}
              aria-current={active || undefined}
              className={`rounded-2xl border p-3 transition ${
                active ? "border-stm-brand bg-stm-brand text-white" : "border-stone-200/80 bg-white shadow-sm hover:border-stm-brand/40"
              }`}
            >
              <p className={`text-xs ${active ? "text-white/80" : "text-stone-500"}`}>
                {time}
                {place && ` · ${place}`}
              </p>
              <p className={`text-2xl font-bold ${active ? "" : "text-stm-green"}`}>{count}</p>
            </Link>
          );
        })}
      </div>
    </section>
  );
}

export interface AttendanceParams {
  date: string;
  ministry: string;
  /** Sunday only */
  service?: string;
  sort: AttendanceSort;
  dir: SortDir;
}

/** `?date=&month=&ministry=&service=&sort=&dir=` link for an attendance page (or its export), keeping current values unless overridden. */
export function attendanceHref(basePath: string, current: AttendanceParams, next: Partial<AttendanceParams> & { month?: string } = {}) {
  const params = new URLSearchParams({ date: next.date ?? current.date });
  if (next.month) params.set("month", next.month);
  const m = next.ministry ?? current.ministry;
  if (m) params.set("ministry", m);
  const svc = next.service ?? current.service;
  if (svc) params.set("service", svc);
  const s = next.sort ?? current.sort;
  const d = next.dir ?? current.dir;
  if (s !== "name" || d !== "asc") params.set("sort", s);
  if (d !== "asc") params.set("dir", d);
  return `${basePath}?${params.toString()}`;
}
