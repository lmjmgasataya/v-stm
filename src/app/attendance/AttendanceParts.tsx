import Link from "next/link";
import { isKindFilter, KIND_FILTERS, type AttendanceRow } from "@/lib/attendance";

import { formatTime } from "@/lib/date";
import { memberDisplayName } from "@/lib/members";
import type { SortDir } from "@/lib/sort";

// Shared by Sunday Attendance (/attendance) and Event Attendance (/event-attendance).

export const SORTS = { last: "Last name", first: "First name", time: "Check-in time" } as const;
export type SortKey = keyof typeof SORTS;
export const SORT_KEYS = Object.keys(SORTS) as SortKey[];

const byText = (a: string, b: string) => a.localeCompare(b, "en", { sensitivity: "base" });
export const COMPARE: Record<SortKey, (a: AttendanceRow, b: AttendanceRow) => number> = {
  last: (a, b) => byText(a.lastName, b.lastName) || byText(a.firstName, b.firstName),
  first: (a, b) => byText(a.firstName, b.firstName) || byText(a.lastName, b.lastName),
  time: (a, b) => a.checkedInAt.getTime() - b.checkedInAt.getTime() || byText(a.lastName, b.lastName),
};

/** "" = everyone; a ministry = STMs in it; "leaders" / "staff" = those lists (events only) */
export function matchesFilter(r: AttendanceRow, filter: string) {
  if (!filter) return true;
  if (filter === "leaders") return r.kind === "leader";
  if (filter === "staff") return r.kind === "staff";
  return r.kind === "stm" && r.ministries.includes(filter);
}

export const filterLabel = (filter: string) => (isKindFilter(filter) ? KIND_FILTERS[filter] : filter);

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

/** Clicking the active sort flips its direction. */
export function SortChips({ sort, dir, href }: { sort: SortKey; dir: SortDir; href: (sort: SortKey, dir: SortDir) => string }) {
  return (
    <div className="flex flex-wrap items-center gap-2 text-sm">
      <span className="text-stone-500">Sort:</span>
      {SORT_KEYS.map((key) => {
        const active = key === sort;
        return (
          <Link
            key={key}
            href={href(key, active && dir === "asc" ? "desc" : "asc")}
            replace
            scroll={false}
            aria-current={active || undefined}
            className={pillCls(active)}
          >
            {SORTS[key]}
            {active && <span aria-label={dir === "asc" ? " ascending" : " descending"}>{dir === "asc" ? " ▲" : " ▼"}</span>}
          </Link>
        );
      })}
    </div>
  );
}

const KIND_BADGES: Partial<Record<AttendanceRow["kind"], string>> = { leader: "Leader", staff: "Pastor/Staff" };

export function AttendanceCard({
  title,
  href,
  rows,
  filter,
  sort,
}: {
  title: string;
  href?: string;
  rows: AttendanceRow[];
  filter: string;
  sort: SortKey;
}) {
  const walkIns = rows.filter((r) => r.isWalkIn).length;
  return (
    <div className="bg-white rounded-2xl border border-stone-200/80 shadow-sm">
      <div className="flex items-center justify-between px-4 py-3 border-b border-stone-100">
        <h3 className="font-semibold text-stone-900">
          {href ? (
            <Link href={href} className="hover:text-stm-brand hover:underline">
              {title}
            </Link>
          ) : (
            title
          )}
        </h3>
        <span className="text-sm font-bold text-stm-green">
          {rows.length}
          {walkIns > 0 && <span className="font-medium text-stm-amber"> · {walkIns} walk-ins</span>}
        </span>
      </div>
      {rows.length === 0 ? (
        <p className="px-4 py-3 text-sm text-stone-400">{filter ? `No ${filterLabel(filter)} check-ins.` : "No check-ins."}</p>
      ) : (
        <ul className="divide-y divide-stone-100">
          {rows.map((r) => (
            <li key={r.key} className="flex items-center justify-between gap-3 px-4 py-2 text-sm">
              <div className="min-w-0">
                <p className="text-stone-900 truncate">
                  {sort === "first" || !r.lastName
                    ? `${r.firstName}${r.nickname ? ` (${r.nickname})` : ""} ${r.lastName}`.trim()
                    : memberDisplayName(r)}
                  {KIND_BADGES[r.kind] && (
                    <span className="ml-2 rounded-full bg-stm-brand/10 px-2 py-0.5 text-[11px] font-semibold text-stm-brand align-middle">
                      {KIND_BADGES[r.kind]}
                    </span>
                  )}
                </p>
                <p className="text-xs text-stone-500 truncate">
                  {r.ministries.join(", ")}
                </p>
              </div>
              <div className="shrink-0 flex items-center gap-2">
                {r.isWalkIn && (
                  <span className="rounded-full bg-stm-amber/15 px-2 py-0.5 text-xs font-semibold text-stm-amber">Walk-in</span>
                )}
                <span className="text-xs text-stone-500">{formatTime(r.checkedInAt)}</span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** `?date=&month=&ministry=&sort=&dir=` link builder for an attendance page, keeping current values unless overridden. */
export function attendanceHref(
  basePath: string,
  current: { date: string; ministry: string; sort: SortKey; dir: SortDir },
  next: { date?: string; month?: string; ministry?: string; sort?: SortKey; dir?: SortDir } = {}
) {
  const params = new URLSearchParams({ date: next.date ?? current.date });
  if (next.month) params.set("month", next.month);
  const m = next.ministry ?? current.ministry;
  if (m) params.set("ministry", m);
  const s = next.sort ?? current.sort;
  const d = next.dir ?? current.dir;
  if (s !== "last" || d !== "asc") params.set("sort", s);
  if (d !== "asc") params.set("dir", d);
  return `${basePath}?${params.toString()}`;
}
