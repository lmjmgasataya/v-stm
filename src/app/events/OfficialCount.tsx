"use client";

import { useState } from "react";
import Link from "next/link";
import { formatDateString } from "@/lib/date";
import { TINT_CLASSES } from "@/lib/event-summary-columns";
import { GROUP_SHORT_LABELS, NOT_COUNTED_SECTION } from "@/lib/official-count-shared";
import type { OfficialCount as OfficialCountData, OfficialCountRow } from "@/lib/official-count";

const numCls = "px-3 py-2 text-right tabular-nums";
const teal = TINT_CLASSES.teal;
const green = TINT_CLASSES.green;
const total = TINT_CLASSES.total;

/**
 * The appreciation night's "official count" (the masterlist's SUMMARY sheet) for one year:
 * invited per service, total invited, confirmed (will attend) and present. Starts collapsed —
 * one row per group (STMs, leaders, pastors & staff) plus the grand total — so the events list
 * below stays in view; the arrow expands the per-ministry details.
 */
export function OfficialCount({ data }: { data: OfficialCountData }) {
  const { year, years, events, groups, sections, grandTotal } = data;
  const [expanded, setExpanded] = useState(false);

  /** `counted` = false: Total and Confirmed show "—" (pastors & staff aren't part of the count) */
  const cells = (row: OfficialCountRow, strong = false, counted = true) => {
    return (
      <>
        {row.byGroup.map((n, i) => (
          <td key={groups[i]} className={`${numCls} ${n || strong ? "text-stone-800" : "text-stone-300"}`}>
            {n}
          </td>
        ))}
        <td className={`${numCls} ${total.bg} ${counted && (row.invited || strong) ? total.text : total.zero}`}>
          {counted ? row.invited : "—"}
        </td>
        <td className={`${numCls} ${teal.bg} ${counted && (row.confirmed || strong) ? teal.text : teal.zero}`}>
          {counted ? row.confirmed : "—"}
        </td>
        <td className={`${numCls} ${green.bg} ${row.present || strong ? green.text : green.zero}`}>{row.present}</td>
      </>
    );
  };

  return (
    <section className="bg-white rounded-2xl border border-stone-200/80 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3 px-5 pt-4 pb-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-stm-brand">Official count</p>
          <h2 className="text-lg font-bold text-stone-900">Service Team Members and Leaders Appreciation Night {year}</h2>
          <p className="text-xs text-stone-500 mt-0.5">
            {events.map((e, i) => (
              <span key={e.id}>
                {i > 0 && " · "}
                <Link href={`/events/${e.id}/summary`} className="hover:text-stm-brand hover:underline">
                  {formatDateString(e.eventDate).replace(/^\w+, /, "").replace(/, \d{4}$/, "")}
                </Link>
              </span>
            ))}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {years.length > 1 && (
            <div className="flex flex-wrap gap-1.5">
              {years.map((y) => (
                <Link
                  key={y}
                  href={y === years[0] ? "/events" : `/events?year=${y}`}
                  aria-current={y === year ? "page" : undefined}
                  className={`rounded-full px-3 py-1 text-xs font-semibold transition ${
                    y === year ? "bg-stm-brand text-white" : "bg-white text-stone-600 ring-1 ring-stone-200 hover:text-stm-brand"
                  }`}
                >
                  {y}
                </Link>
              ))}
            </div>
          )}
          <button
            type="button"
            onClick={() => setExpanded((e) => !e)}
            aria-expanded={expanded}
            aria-controls="official-count-table"
            className="inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-1.5 text-xs font-semibold text-stone-700 ring-1 ring-stone-200 hover:text-stm-brand hover:ring-stm-brand/40 transition"
          >
            {expanded ? "Hide details" : "Show details"}
            <svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true" className={`h-4 w-4 transition-transform ${expanded ? "rotate-180" : ""}`}>
              <path fillRule="evenodd" d="M5.23 7.21a.75.75 0 0 1 1.06.02L10 11.17l3.71-3.94a.75.75 0 1 1 1.08 1.04l-4.25 4.5a.75.75 0 0 1-1.08 0l-4.25-4.5a.75.75 0 0 1 .02-1.06Z" clipRule="evenodd" />
            </svg>
          </button>
        </div>
      </div>

      <div id="official-count-table" className="overflow-x-auto border-t border-stone-100">
        <table className="w-full text-sm">
          <thead className="bg-stone-50 text-xs uppercase tracking-wide text-stone-500">
            <tr>
              <th className="px-3 py-2 text-left font-semibold">Group</th>
              {groups.map((g) => (
                <th key={g} title={g} className="px-3 py-2 text-right font-semibold whitespace-nowrap">
                  {GROUP_SHORT_LABELS[g]}
                </th>
              ))}
              <th className={`px-3 py-2 text-right whitespace-nowrap ${total.bg} ${total.head}`}>Total</th>
              <th className={`px-3 py-2 text-right font-semibold whitespace-nowrap ${teal.bg} ${teal.head}`}>Confirmed</th>
              <th className={`px-3 py-2 text-right font-semibold whitespace-nowrap ${green.bg} ${green.head}`}>Present</th>
            </tr>
          </thead>
          {!expanded && (
            // Collapsed: one row per group
            <tbody>
              {sections.map((s) => (
                <tr key={s.title} className="border-t border-stone-100">
                  <td className="px-3 py-2 font-medium text-stone-800">{s.title}</td>
                  {cells(s.total, true, s.title !== NOT_COUNTED_SECTION)}
                </tr>
              ))}
            </tbody>
          )}
          {expanded && sections.map((s) => (
            <tbody key={s.title} className="border-t border-stone-200">
              <tr>
                <th colSpan={groups.length + 4} className="px-3 pt-3 pb-1 text-left text-xs font-semibold uppercase tracking-wide text-stm-brand">
                  {s.title}
                </th>
              </tr>
              {s.rows.map((row) => (
                <tr key={row.label} className="border-t border-stone-100">
                  <td className="px-3 py-2 text-stone-800">
                    {row.label}
                  </td>
                  {cells(row, false, s.title !== NOT_COUNTED_SECTION)}
                </tr>
              ))}
              {s.rows.length > 1 && (
                <tr className="border-t border-stone-200 bg-stone-50/60 font-semibold">
                  <td className="px-3 py-2 text-stone-700">Subtotal</td>
                  {cells(s.total, true, s.title !== NOT_COUNTED_SECTION)}
                </tr>
              )}
            </tbody>
          ))}
          <tfoot className="border-t-2 border-stone-300 bg-stm-brand/5 font-bold">
            <tr>
              <td className="px-3 py-2.5 text-stone-900">Grand total</td>
              {cells(grandTotal, true)}
            </tr>
          </tfoot>
        </table>
      </div>
      <p className="px-5 py-3 text-xs text-stone-400 border-t border-stone-100">
        Per service = invited (on the list). Confirmed = said they will attend. Present = checked in, walk-ins included. Pastors &amp;
        staff are listed once per night they&apos;re invited to (under that night&apos;s service) but aren&apos;t counted in Total,
        Confirmed or the grand total. An STM in more than one ministry counts in
        each ministry row but once in the totals.
      </p>
    </section>
  );
}
