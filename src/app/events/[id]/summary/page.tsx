import { requireViewer } from "@/lib/access";
import { getEventOrNotFound } from "@/lib/events";
import { getEventSummary } from "@/lib/event-people";
import {
  SUMMARY_GROUP_LABELS,
  TINT_CLASSES,
  summaryColumns,
  type SummaryColumn,
  type SummaryColumnGroup,
} from "@/lib/event-summary-columns";
import { StatCard } from "@/components/StatCard";
import { secondaryBtnCls } from "@/components/form";

const numCls = "px-3 py-2 text-right tabular-nums";

/** Classes for a value cell; `strong` = subtotal/total rows (zeros stay readable there). */
function cellCls(c: SummaryColumn, value: number, strong = false) {
  const tint = c.tint && TINT_CLASSES[c.tint];
  if (tint) return `${numCls} ${tint.bg} ${value || strong ? tint.text : tint.zero}`;
  return `${numCls} ${value || strong ? "text-stone-800" : "text-stone-300"}`;
}

function headCls(c: SummaryColumn) {
  const tint = c.tint && TINT_CLASSES[c.tint];
  return `px-3 py-2 text-right font-semibold whitespace-nowrap ${tint ? `${tint.bg} ${tint.head}` : ""}`;
}

/** Consecutive columns of the same group → one header cell spanning them */
function groupSpans(columns: SummaryColumn[]): { group: SummaryColumnGroup; span: number }[] {
  const spans: { group: SummaryColumnGroup; span: number }[] = [];
  for (const c of columns) {
    const last = spans.at(-1);
    if (last?.group === c.group) last.span++;
    else spans.push({ group: c.group, span: 1 });
  }
  return spans;
}

export default async function EventSummaryPage({ params }: { params: Promise<{ id: string }> }) {
  await requireViewer();
  const event = await getEventOrNotFound((await params).id);
  const { sections, grandTotal } = await getEventSummary(event.id);
  const columns = summaryColumns(event.preRegistration);
  const hasData = sections.length > 0;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex justify-end -mb-2">
        <a
          href={`/events/${event.id}/summary/export`}
          aria-disabled={!hasData}
          className={`${secondaryBtnCls} ${hasData ? "" : "pointer-events-none opacity-50"}`}
        >
          Download Excel
        </a>
      </div>

      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        {event.preRegistration && (
          <StatCard label="Will attend" value={grandTotal.willAttend} hint={`of ${grandTotal.invited} invited`} />
        )}
        {event.preRegistration && <StatCard label="Pre-registered checked in" value={grandTotal.checkedIn} />}
        {event.preRegistration && <StatCard label="Walk-ins" value={grandTotal.walkIns} />}
        <StatCard label="Total present" value={grandTotal.present} />
      </div>

      {sections.length === 0 ? (
        <div className="bg-white rounded-2xl border border-dashed border-stone-300 p-10 text-center text-sm text-stone-500">
          No one invited or checked in yet.
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-stone-200/80 shadow-sm overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-stone-50 text-xs uppercase tracking-wide text-stone-500">
              {event.preRegistration && (
                // RSVP (before the event) vs At the door (the night itself)
                <tr>
                  <th rowSpan={2} className="px-3 py-2 text-left font-semibold align-bottom">
                    Group
                  </th>
                  {groupSpans(columns).map(({ group, span }) => (
                    <th
                      key={group}
                      colSpan={span}
                      className={`px-3 pt-2 pb-1 text-center text-[11px] font-bold tracking-wider text-stone-600 border-b border-stone-200 ${
                        group === "door" ? "border-l-2 border-l-stone-300" : ""
                      }`}
                    >
                      {SUMMARY_GROUP_LABELS[group]}
                    </th>
                  ))}
                </tr>
              )}
              <tr>
                {!event.preRegistration && <th className="px-3 py-2 text-left font-semibold">Group</th>}
                {columns.map((c, i) => (
                  <th
                    key={c.key}
                    className={`${headCls(c)} ${i > 0 && c.group !== columns[i - 1].group && c.tint !== "total" ? "border-l-2 border-l-stone-300" : ""}`}
                  >
                    {c.label}
                  </th>
                ))}
              </tr>
            </thead>
            {sections.map((section) => (
              <tbody key={section.title} className="border-t border-stone-200">
                <tr>
                  <th colSpan={columns.length + 1} className="px-3 pt-3 pb-1 text-left text-xs font-semibold uppercase tracking-wide text-stm-brand">
                    {section.title}
                  </th>
                </tr>
                {section.rows.map((row) => (
                  <tr key={row.label} className="border-t border-stone-100">
                    <td className="px-3 py-2 text-stone-800">
                      {row.label}
                    </td>
                    {columns.map((c) => (
                      <td key={c.key} className={`${cellCls(c, row[c.key])} ${divider(c, columns)}`}>
                        {row[c.key]}
                      </td>
                    ))}
                  </tr>
                ))}
                {section.rows.length > 1 && (
                  <tr className="border-t border-stone-200 bg-stone-50/60 font-semibold">
                    <td className="px-3 py-2 text-stone-700">Subtotal</td>
                    {columns.map((c) => (
                      <td key={c.key} className={`${cellCls(c, section.total[c.key], true)} ${divider(c, columns)}`}>
                        {section.total[c.key]}
                      </td>
                    ))}
                  </tr>
                )}
              </tbody>
            ))}
            <tfoot className="border-t-2 border-stone-300 bg-stm-brand/5 font-bold">
              <tr>
                <td className="px-3 py-2.5 text-stone-900">Grand total</td>
                {columns.map((c) => (
                  <td key={c.key} className={`${cellCls(c, grandTotal[c.key], true)} ${divider(c, columns)} font-bold py-2.5`}>
                    {grandTotal[c.key]}
                  </td>
                ))}
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      <p className="text-xs text-stone-400">
        {event.preRegistration
          ? "Invited = on this event's list. Will attend / won't attend = their RSVP. Checked in = pre-registered people who came; walk-ins = everyone else who was checked in. "
          : ""}
        An STM in more than one ministry counts in each ministry row but once in the subtotals. STMs and leaders are listed per service when the event has more than one.
      </p>
    </div>
  );
}

/** Divider at the start of the "At the door" group (the total column has its own) */
function divider(c: SummaryColumn, columns: SummaryColumn[]) {
  const i = columns.indexOf(c);
  return i > 0 && c.group !== columns[i - 1].group && c.tint !== "total" ? "border-l-2 border-l-stone-300" : "";
}
