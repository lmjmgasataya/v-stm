import Link from "next/link";
import { requireViewer, type Viewer } from "@/lib/access";
import { formatShortDate } from "@/lib/date";
import { FOLLOW_UP_AFTER, LOOKBACK, RECENT, getEngagement, insightsScope, type EngagementMember } from "@/lib/insights";
import { memberDisplayName } from "@/lib/members";
import { NO_MINISTRY } from "@/lib/reports";
import { BarList } from "@/components/BarList";
import { StatCard, percent } from "@/components/StatCard";
import { GroupFilter } from "../GroupFilter";

export default async function EngagementPage({ searchParams }: { searchParams: Promise<{ group?: string }> }) {
  const viewer = await requireViewer();
  const scope = insightsScope(viewer, (await searchParams).group);
  const e = await getEngagement(viewer, scope);
  const n = e.dates.length;
  const showService = scope.attending.length > 1;
  const sundays = (k: number) => `${k} Sunday${k === 1 ? "" : "s"}`;

  return (
    <div className="flex flex-col gap-6">
      <p className="text-sm text-stone-500 -mt-2">
        Service team members on the roster · {scope.name}
        {n > 0 && (
          <span className="text-stone-400">
            {" "}
            · last {sundays(n)} with check-ins ({formatShortDate(e.dates[n - 1])} – {formatShortDate(e.dates[0])})
          </span>
        )}
      </p>

      <GroupFilter basePath="/insights/engagement" groups={scope.groups} group={scope.group} />

      {e.roster === 0 ? (
        <Empty>No members on the roster{scope.group ? ` in ${scope.group}` : ""} yet.</Empty>
      ) : n === 0 ? (
        <Empty>No service check-ins yet — engagement shows up after the first Sunday.</Empty>
      ) : (
        <>
          <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
            <StatCard label="On the roster" value={e.roster.toLocaleString()} />
            <StatCard
              label={`Served in the last ${Math.min(RECENT, n)}`}
              value={percent(e.servedRecently, e.roster)}
              hint={`${e.servedRecently} of ${e.roster} members`}
            />
            <StatCard label="Need follow-up" value={e.followUp.length} hint={`Missed the last ${sundays(Math.min(FOLLOW_UP_AFTER, n))}`} />
            <StatCard label="Never checked in" value={e.neverServed.length} hint="On the roster, no check-ins yet" />
          </div>

          <section className="bg-white rounded-2xl border border-stone-200/80 shadow-sm p-5">
            <h2 className="font-bold text-stone-900">How often members served</h2>
            <p className="text-xs text-stone-500 mb-4">
              Sundays served out of the last {n < LOOKBACK ? n : LOOKBACK} with check-ins · of {e.roster} members on the roster
            </p>
            <BarList
              rows={e.frequency.map((b) => ({
                label: b.max === 0 ? `None of ${n}` : `${b.label} Sundays`,
                text: b.max === 0 ? `Served none of the last ${n}` : `Served ${b.label} Sundays`,
                value: b.value,
                muted: b.max === 0,
              }))}
              total={e.roster}
            />
          </section>

          <MemberSection
            title="Need follow-up"
            subtitle={`Served before, but missed the last ${sundays(Math.min(FOLLOW_UP_AFTER, n))} · most recently seen first`}
            empty="Everyone who has served came in recently."
            people={e.followUp}
            viewer={viewer}
            showService={showService}
            showLastServed
          />

          {e.neverServed.length > 0 && (
            <MemberSection
              title="Never checked in"
              subtitle="On the roster with no service check-ins yet · newest additions first"
              empty=""
              people={e.neverServed}
              viewer={viewer}
              showService={showService}
            />
          )}
        </>
      )}
    </div>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <div className="bg-white rounded-2xl border border-dashed border-stone-300 p-12 text-center text-sm text-stone-500">{children}</div>;
}

function MemberSection({
  title,
  subtitle,
  empty,
  people,
  viewer,
  showService,
  showLastServed = false,
}: {
  title: string;
  subtitle: string;
  empty: string;
  people: EngagementMember[];
  viewer: Viewer;
  showService: boolean;
  showLastServed?: boolean;
}) {
  const th = "px-4 py-2.5 text-left font-semibold uppercase tracking-wide";
  return (
    <section className="bg-white rounded-2xl border border-stone-200/80 shadow-sm">
      <div className="px-5 pt-5 pb-3">
        <h2 className="font-bold text-stone-900">
          {title} <span className="font-semibold text-stone-400">{people.length}</span>
        </h2>
        <p className="text-xs text-stone-500">{subtitle}</p>
      </div>
      {people.length === 0 ? (
        <p className="px-5 pb-6 text-sm text-stone-400">{empty}</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[40rem] text-sm">
            <thead>
              <tr className="border-y border-stone-200 bg-stone-50 text-xs text-stone-500">
                <th scope="col" className={th}>Name</th>
                <th scope="col" className={th}>Ministry</th>
                {showService && <th scope="col" className={th}>Service</th>}
                {showLastServed && <th scope="col" className={th}>Last served</th>}
                <th scope="col" className={th}>Mobile</th>
                <th scope="col" className={th}>Messenger</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {people.map((m) => (
                <tr key={m.id}>
                  <td className="px-4 py-2.5 font-medium text-stone-900">
                    {/* Admins open the member; everyone else finds them in the list */}
                    <Link
                      href={viewer.canManageMembers ? `/members/${m.id}/edit` : `/members?q=${encodeURIComponent(`${m.firstName} ${m.lastName}`)}`}
                      className="hover:text-stm-brand hover:underline"
                    >
                      {memberDisplayName(m)}
                    </Link>
                  </td>
                  <td className="px-4 py-2.5 text-stone-600">
                    {m.ministry === NO_MINISTRY ? <span className="text-stone-400">—</span> : m.ministry}
                  </td>
                  {showService && <td className="px-4 py-2.5 text-stone-600 whitespace-nowrap">{m.serviceAttending?.split(" - ")[0] ?? "—"}</td>}
                  {showLastServed && (
                    <td className="px-4 py-2.5 text-stone-600 whitespace-nowrap tabular-nums">{m.lastServed ? formatShortDate(m.lastServed) : "—"}</td>
                  )}
                  <td className="px-4 py-2.5 whitespace-nowrap tabular-nums">
                    {m.mobileNumber ? (
                      <a href={`tel:${m.mobileNumber.replace(/[^\d+]/g, "")}`} className="text-stm-brand hover:underline">
                        {m.mobileNumber}
                      </a>
                    ) : (
                      <span className="text-stone-400">—</span>
                    )}
                  </td>
                  <td className="px-4 py-2.5 text-stone-600">{m.facebookMessengerName || <span className="text-stone-400">—</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
