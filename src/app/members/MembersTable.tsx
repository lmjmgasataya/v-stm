import Link from "next/link";
import type { Member } from "@/db/schema";
import type { ActivityRule } from "@/lib/activity-rule";
import { formatDateString } from "@/lib/date";
import { SortableTh } from "@/components/SortableTh";
import type { SortDir } from "@/lib/sort";
import type { MemberSortColumn } from "./sortColumns";

const HEADERS: [MemberSortColumn, string][] = [
  ["lastName", "Last name"],
  ["firstName", "First name"],
  ["mobileNumber", "Mobile"],
  ["serviceAttending", "Service"],
  ["lifestage", "Lifestage"],
];

export function MembersTable({
  rows,
  sort,
  dir,
  canEdit,
  activity,
}: {
  rows: (Member & { lastServed: string | null; daysServed: number | null })[];
  sort: MemberSortColumn;
  dir: SortDir;
  canEdit: boolean;
  /** The activity rule when it's on — adds a "Last served" column and inactive badges. */
  activity: ActivityRule | null;
}) {
  if (rows.length === 0) {
    return (
      <div className="bg-white rounded-2xl border border-dashed border-stone-300 p-10 text-center text-sm text-stone-500">
        No service team members found.
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl border border-stone-200/80 shadow-sm overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="bg-stone-50 text-left text-xs uppercase tracking-wide text-stone-500">
          <tr>
            {HEADERS.map(([column, label]) => (
              <SortableTh key={column} column={column} label={label} sort={sort} dir={dir} />
            ))}
            <th className="px-4 py-3 font-medium">Ministry</th>
            <th className="px-4 py-3 font-medium whitespace-nowrap" title="Submitted the Service Team Members Profile?">
              Profile
            </th>
            {activity && <th className="px-4 py-3 font-medium whitespace-nowrap">Last served</th>}
            {canEdit && <th className="px-4 py-3" />}
          </tr>
        </thead>
        <tbody className="divide-y divide-stone-100">
          {rows.map((m) => {
            // With the rule on, someone still on the roster can be inactive by not serving lately
            const belowRule = activity !== null && m.isActive && (m.daysServed ?? 0) < activity.minServes;
            return (
            <tr key={m.id} className={`hover:bg-stone-50/60 ${m.isActive && !belowRule ? "" : "opacity-60"}`}>
              <td className="px-4 py-2.5 font-medium text-stone-900 whitespace-nowrap">
                {m.lastName}
                {!m.isActive && (
                  <span className="ml-2 rounded-full bg-stone-100 px-2 py-0.5 text-xs font-normal text-stone-500">
                    {activity ? "Off roster" : "Inactive"}
                  </span>
                )}
                {belowRule && (
                  <span
                    className="ml-2 rounded-full bg-stm-amber/15 px-2 py-0.5 text-xs font-semibold text-stm-amber"
                    title={`Served ${m.daysServed ?? 0} day(s) in the last ${activity.withinDays} days`}
                  >
                    Inactive
                  </span>
                )}
              </td>
              <td className="px-4 py-2.5 text-stone-900 whitespace-nowrap">
                {m.firstName}
                {m.middleInitial && ` ${m.middleInitial}.`}
                {m.nickname && <span className="text-stone-400"> ({m.nickname})</span>}
              </td>
              <td className="px-4 py-2.5 text-stone-600 whitespace-nowrap">{m.mobileNumber || "—"}</td>
              <td className="px-4 py-2.5 text-stone-600 whitespace-nowrap">{m.serviceAttending ?? "—"}</td>
              <td className="px-4 py-2.5 text-stone-600 whitespace-nowrap">{m.lifestage ?? "—"}</td>
              <td className="px-4 py-2.5">
                <div className="flex flex-wrap gap-1">
                  {m.ministries.map((ministry) => (
                    <span key={ministry} className="rounded-full bg-stm-brand/10 px-2 py-0.5 text-xs text-stm-brand whitespace-nowrap">
                      {ministry}
                    </span>
                  ))}
                </div>
              </td>
              <td className="px-4 py-2.5 whitespace-nowrap">
                {/* Read-only here; admins change it on the member's edit form */}
                {m.profileSubmitted ? (
                  <span className="text-stm-green font-medium">Submitted</span>
                ) : (
                  <span className="text-stm-amber font-medium">Not yet</span>
                )}
              </td>
              {activity && (
                <td className="px-4 py-2.5 text-stone-600 whitespace-nowrap">
                  {m.lastServed ? formatDateString(m.lastServed).replace(/^\w+, /, "") : "Never"}
                </td>
              )}
              {canEdit && (
                <td className="px-4 py-2.5 text-right whitespace-nowrap">
                  <Link href={`/members/${m.id}/edit`} className="text-stm-brand hover:underline">
                    Edit
                  </Link>
                </td>
              )}
            </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
