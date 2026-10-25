import Link from "next/link";
import { requireViewer } from "@/lib/access";
import { SERVICE_GROUPS, SERVICE_GROUP_NAMES, isServiceGroup } from "@/lib/constants";
import { BarList, type BarRow } from "@/components/BarList";
import { MinistryName } from "@/components/MinistryName";
import { StatCard, percent } from "@/components/StatCard";
import { NOT_SET, getDemographics, type Count } from "@/lib/reports";
import { describeActivityRule } from "@/lib/activity-rule";
import { getActivityRule } from "@/lib/settings";

export default async function DemographicsPage({ searchParams }: { searchParams: Promise<{ group?: string }> }) {
  const viewer = await requireViewer();
  const { group: groupParam } = await searchParams;
  // Filter by service group. A group user only has their own group, so they get no filter.
  const groups = viewer.serviceGroup ? [] : SERVICE_GROUP_NAMES;
  const group = isServiceGroup(groupParam) && groups.includes(groupParam) ? groupParam : null;
  const services = group ? SERVICE_GROUPS[group] : viewer.services;
  const rule = await getActivityRule();
  const d = await getDemographics(viewer, group ? services : null, rule);

  const toRows = (counts: Count[], label?: (c: Count) => React.ReactNode): BarRow[] =>
    counts.map((c) => ({ label: label ? label(c) : c.label, text: c.label, value: c.value, muted: c.label === NOT_SET }));
  const scopeName = group ?? viewer.serviceGroup ?? "All services";

  return (
    <div className="flex flex-col gap-6">
      <p className="text-sm text-stone-500 -mt-2">
        Active service team members · {scopeName}
        {rule.enabled && <span className="text-stone-400"> · {describeActivityRule(rule)}</span>}
      </p>

      {/* Filters: one row, above everything they affect */}
      {groups.length > 0 && (
        <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Service group">
          {[null, ...groups].map((g) => {
            const active = g === group;
            return (
              <Link
                key={g ?? "all"}
                href={g ? `/reports/demographics?group=${encodeURIComponent(g)}` : "/reports/demographics"}
                replace
                scroll={false}
                aria-current={active || undefined}
                className={`rounded-full px-3.5 py-1.5 text-sm font-semibold transition ${
                  active
                    ? "bg-stm-brand text-white shadow-sm"
                    : "bg-white text-stone-600 ring-1 ring-stone-200 hover:ring-stm-brand/40 hover:text-stm-brand"
                }`}
              >
                {g ?? "All"}
              </Link>
            );
          })}
        </div>
      )}

      {d.total === 0 ? (
        <div className="bg-white rounded-2xl border border-dashed border-stone-300 p-12 text-center text-sm text-stone-500">
          No active members{group ? ` in ${group}` : ""} yet.
        </div>
      ) : (
        <>
          <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
            <StatCard label="Active members" value={d.total.toLocaleString()} />
            <StatCard label="Average age" value={d.averageAge ?? "—"} hint={d.averageAge === null ? "No ages recorded" : undefined} />
            <StatCard label="With a VGL" value={percent(d.withVgl, d.total)} hint={`${d.withVgl} of ${d.total}`} />
            <StatCard
              label="Full discipleship journey"
              value={percent(d.journeyComplete, d.total)}
              hint={`${d.journeyComplete} completed all steps`}
            />
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <ChartCard title="Gender" subtitle={`of ${d.total} members`}>
              <BarList rows={toRows(d.gender)} total={d.total} />
            </ChartCard>
            <ChartCard title="Age group" subtitle={`of ${d.total} members`}>
              <BarList rows={toRows(d.ageGroups)} total={d.total} />
            </ChartCard>
            <ChartCard title="Lifestage" subtitle={`of ${d.total} members`}>
              <BarList rows={toRows(d.lifestage)} total={d.total} />
            </ChartCard>
            <ChartCard title="Ministry" subtitle="Members serving in several ministries count in each">
              <BarList rows={toRows(d.ministries, (c) => <MinistryName ministry={c.label} />)} total={d.total} />
            </ChartCard>
            <ChartCard title="Discipleship journey" subtitle="Members who completed each step">
              <BarList rows={toRows(d.journey)} total={d.total} />
            </ChartCard>
            <ChartCard title="Victory Group Leader" subtitle={`of ${d.total} members`}>
              <BarList rows={toRows(d.vgl)} total={d.total} />
            </ChartCard>
            {/* Split by service whenever the view spans more than one (e.g. 2PM vs 4PM) */}
            {services.length > 1 && (
              <ChartCard title="Service attending" subtitle={`of ${d.total} members`}>
                <BarList rows={toRows(d.services)} total={d.total} />
              </ChartCard>
            )}
          </div>
        </>
      )}
    </div>
  );
}

function ChartCard({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) {
  return (
    <section className="bg-white rounded-2xl border border-stone-200/80 shadow-sm p-5">
      <h2 className="font-bold text-stone-900">{title}</h2>
      <p className="text-xs text-stone-500 mb-4">{subtitle}</p>
      {children}
    </section>
  );
}
