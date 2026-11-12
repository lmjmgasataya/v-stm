import Link from "next/link";
import { requireViewer } from "@/lib/access";
import { describeActivityRule } from "@/lib/activity-rule";
import { formatShortDate } from "@/lib/date";
import { RECENT, getMinistryHealth, insightsScope, type MinistryHealthRow } from "@/lib/insights";
import { NO_MINISTRY } from "@/lib/reports";
import { getActivityRule } from "@/lib/settings";
import { MinistryName } from "@/components/MinistryName";
import { GroupFilter } from "../GroupFilter";

export default async function MinistryHealthPage({ searchParams }: { searchParams: Promise<{ group?: string }> }) {
  const viewer = await requireViewer();
  const scope = insightsScope(viewer, (await searchParams).group);
  const rule = await getActivityRule();
  const h = await getMinistryHealth(viewer, scope, rule);
  const n = h.dates.length;
  const recent = Math.min(RECENT, n);
  const th = "px-3 py-2.5 font-semibold";

  return (
    <div className="flex flex-col gap-6">
      <p className="text-sm text-stone-500 -mt-2">
        Service team members on the roster, per ministry · {scope.name}
        {n > 0 && (
          <span className="text-stone-400">
            {" "}
            · last {n} Sunday{n === 1 ? "" : "s"} with check-ins ({formatShortDate(h.dates[n - 1])} – {formatShortDate(h.dates[0])})
          </span>
        )}
      </p>

      <GroupFilter basePath="/insights/ministries" groups={scope.groups} group={scope.group} />

      {h.total.roster === 0 ? (
        <div className="bg-white rounded-2xl border border-dashed border-stone-300 p-12 text-center text-sm text-stone-500">
          No members on the roster{scope.group ? ` in ${scope.group}` : ""} yet.
        </div>
      ) : (
        <section className="bg-white rounded-2xl border border-stone-200/80 shadow-sm">
          <div className="px-5 pt-5 pb-3">
            <h2 className="font-bold text-stone-900">Ministry health</h2>
            <p className="text-xs text-stone-500">
              How many each ministry has, how many serve on a typical Sunday, and how much of the team served lately.
              {rule.enabled && ` Active = ${describeActivityRule(rule).toLowerCase()}.`}
            </p>
            {n === 0 && (
              <p className="mt-2 rounded-lg bg-stone-50 px-3 py-2 text-xs text-stone-500">
                No service check-ins yet — the serving columns fill in after the first Sunday.
              </p>
            )}
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[44rem] text-sm">
              <thead>
                <tr className="border-y border-stone-200 bg-stone-50 text-xs text-stone-500">
                  <th scope="col" className={`${th} pl-5 text-left uppercase tracking-wide`}>Ministry</th>
                  <th scope="col" className={`${th} text-right`}>On roster</th>
                  {rule.enabled && <th scope="col" className={`${th} text-right`}>Active</th>}
                  <th scope="col" className={`${th} text-right`} title={`Average STMs serving per Sunday, over the last ${n}`}>
                    Avg per Sunday
                  </th>
                  <th scope="col" className={`${th} text-right`}>{n ? formatShortDate(h.dates[0]) : "Latest"}</th>
                  <th scope="col" className={`${th} pr-5 text-left`}>Served in the last {recent || RECENT}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {h.rows.map((r) => (
                  <Row key={r.ministry} row={r} showActive={rule.enabled} />
                ))}
              </tbody>
              <tfoot>
                <Row row={h.total} showActive={rule.enabled} total />
              </tfoot>
            </table>
          </div>
          <p className="px-5 py-3 text-xs text-stone-400">
            Each STM counts in their ministry. The {n ? formatShortDate(h.dates[0]) : "latest"} column is the latest Sunday with check-ins.
          </p>
        </section>
      )}
    </div>
  );
}

function Row({ row, showActive, total = false }: { row: MinistryHealthRow; showActive: boolean; total?: boolean }) {
  const pct = row.roster ? Math.round((row.servedRecently / row.roster) * 100) : 0;
  const cell = `px-3 py-2.5 text-right tabular-nums ${total ? "font-bold text-stone-900" : "text-stone-700"}`;
  const name =
    row.ministry === NO_MINISTRY ? (
      <span className="text-stone-400">{row.ministry}</span>
    ) : total ? (
      row.ministry
    ) : (
      <Link href={`/members?ministry=${encodeURIComponent(row.ministry)}`} className="hover:text-stm-brand hover:underline">
        <MinistryName ministry={row.ministry} />
      </Link>
    );
  return (
    <tr className={total ? "border-t-2 border-stone-200 bg-stone-50" : undefined}>
      <th scope="row" className={`py-2.5 pl-5 pr-3 text-left whitespace-nowrap ${total ? "font-bold text-stone-900" : "font-medium text-stone-700"}`}>
        {name}
      </th>
      <td className={cell}>{row.roster}</td>
      {showActive && <td className={cell}>{row.active}</td>}
      <td className={cell}>{row.average}</td>
      <td className={cell}>{row.latest}</td>
      <td className="py-2.5 pl-3 pr-5">
        <div
          className="flex items-center gap-3"
          title={`${row.servedRecently} of ${row.roster} served in the last few Sundays`}
          aria-label={`${row.servedRecently} of ${row.roster}, ${pct}%`}
        >
          {/* Meter: one teal, light track; the number carries the value */}
          <span className="h-2 w-24 shrink-0 overflow-hidden rounded-full bg-stone-100" aria-hidden="true">
            <span className="block h-full rounded-full bg-stm-brand" style={{ width: `${pct}%` }} />
          </span>
          <span className={`tabular-nums whitespace-nowrap ${total ? "font-bold text-stone-900" : "text-stone-700"}`}>
            {pct}% <span className="font-normal text-stone-400">· {row.servedRecently}</span>
          </span>
        </div>
      </td>
    </tr>
  );
}
