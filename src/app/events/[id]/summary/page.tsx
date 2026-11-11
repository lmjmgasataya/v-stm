import { requireViewer } from "@/lib/access";
import { getEventOrNotFound } from "@/lib/events";
import { getEventSummary, type SummaryCounts } from "@/lib/event-people";
import { MinistryName } from "@/components/MinistryName";
import { StatCard } from "@/components/StatCard";

const COLUMNS: { key: keyof SummaryCounts; label: string; preRegOnly?: boolean }[] = [
  { key: "invited", label: "Invited", preRegOnly: true },
  { key: "willAttend", label: "Will attend", preRegOnly: true },
  { key: "wontAttend", label: "Won't attend", preRegOnly: true },
  { key: "checkedIn", label: "Checked in", preRegOnly: true },
  { key: "walkIns", label: "Walk-ins", preRegOnly: true },
  { key: "present", label: "Total present" },
];

const numCls = "px-3 py-2 text-right tabular-nums";

export default async function EventSummaryPage({ params }: { params: Promise<{ id: string }> }) {
  await requireViewer();
  const event = await getEventOrNotFound((await params).id);
  const { sections, grandTotal, byService } = await getEventSummary(event.id);
  const columns = COLUMNS.filter((c) => event.preRegistration || !c.preRegOnly);

  return (
    <div className="flex flex-col gap-6">
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
              <tr>
                <th className="px-3 py-2 text-left font-semibold">Group</th>
                {columns.map((c) => (
                  <th key={c.key} className="px-3 py-2 text-right font-semibold whitespace-nowrap">
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
                      <MinistryName ministry={row.label} />
                    </td>
                    {columns.map((c) => (
                      <td key={c.key} className={`${numCls} ${row[c.key] ? "text-stone-800" : "text-stone-300"}`}>
                        {row[c.key]}
                      </td>
                    ))}
                  </tr>
                ))}
                {section.rows.length > 1 && (
                  <tr className="border-t border-stone-200 bg-stone-50/60 font-semibold">
                    <td className="px-3 py-2 text-stone-700">Subtotal</td>
                    {columns.map((c) => (
                      <td key={c.key} className={`${numCls} text-stone-800`}>
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
                  <td key={c.key} className={`${numCls} text-stone-900`}>
                    {grandTotal[c.key]}
                  </td>
                ))}
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      {byService && (
        <section>
          <h2 className="text-sm font-semibold uppercase tracking-wide text-stone-500 mb-2">STMs by service</h2>
          <div className="bg-white rounded-2xl border border-stone-200/80 shadow-sm overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-stone-50 text-xs uppercase tracking-wide text-stone-500">
                <tr>
                  <th rowSpan={2} className="px-3 py-2 text-left font-semibold align-bottom">
                    Ministry
                  </th>
                  {byService.groups.map((g) => (
                    <th key={g} colSpan={event.preRegistration ? 2 : 1} className="px-3 pt-2 text-center font-semibold whitespace-nowrap">
                      {g}
                    </th>
                  ))}
                </tr>
                <tr>
                  {byService.groups.map((g) => (
                    <SubHeads key={g} preRegistration={event.preRegistration} />
                  ))}
                </tr>
              </thead>
              <tbody>
                {byService.rows.map((row) => (
                  <tr key={row.label} className="border-t border-stone-100">
                    <td className="px-3 py-2 text-stone-800">
                      <MinistryName ministry={row.label} />
                    </td>
                    {row.cells.map((cell, i) => (
                      <Cells key={i} cell={cell} preRegistration={event.preRegistration} />
                    ))}
                  </tr>
                ))}
              </tbody>
              <tfoot className="border-t-2 border-stone-300 bg-stm-brand/5 font-bold">
                <tr>
                  <td className="px-3 py-2.5 text-stone-900">Total</td>
                  {byService.totals.map((cell, i) => (
                    <Cells key={i} cell={cell} preRegistration={event.preRegistration} />
                  ))}
                </tr>
              </tfoot>
            </table>
          </div>
        </section>
      )}

      <p className="text-xs text-stone-400">
        {event.preRegistration
          ? "Invited = on this event's list. Will attend / won't attend = their RSVP. Checked in = pre-registered people who came; walk-ins = everyone else who was checked in. "
          : ""}
        An STM in more than one ministry counts in each ministry row but once in the subtotals.
      </p>
    </div>
  );
}

function SubHeads({ preRegistration }: { preRegistration: boolean }) {
  return (
    <>
      {preRegistration && <th className="px-3 pb-2 text-right font-medium normal-case">Will attend</th>}
      <th className="px-3 pb-2 text-right font-medium normal-case">Present</th>
    </>
  );
}

function Cells({ cell, preRegistration }: { cell: { willAttend: number; present: number }; preRegistration: boolean }) {
  return (
    <>
      {preRegistration && <td className={`${numCls} ${cell.willAttend ? "" : "text-stone-300"}`}>{cell.willAttend}</td>}
      <td className={`${numCls} ${cell.present ? "" : "text-stone-300"}`}>{cell.present}</td>
    </>
  );
}
