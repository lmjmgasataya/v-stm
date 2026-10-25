import Link from "next/link";
import type { Member } from "@/db/schema";
import { MinistryName } from "@/components/MinistryName";
import { SortableTh } from "@/components/SortableTh";
import type { SortDir } from "@/lib/sort";
import type { MemberSortColumn } from "./sortColumns";

const HEADERS: [MemberSortColumn, string][] = [
  ["lastName", "Last name"],
  ["firstName", "First name"],
  ["mobileNumber", "Mobile"],
  ["serviceAttending", "Service"],
  ["vglName", "VGL"],
  ["lifestage", "Lifestage"],
  ["age", "Age"],
];

export function MembersTable({
  rows,
  sort,
  dir,
  canEdit,
}: {
  rows: Member[];
  sort: MemberSortColumn;
  dir: SortDir;
  canEdit: boolean;
}) {
  if (rows.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-dashed border-gray-300 p-10 text-center text-sm text-gray-500">
        No service team members found.
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-500">
          <tr>
            {HEADERS.map(([column, label]) => (
              <SortableTh key={column} column={column} label={label} sort={sort} dir={dir} />
            ))}
            <th className="px-4 py-3 font-medium">Ministry</th>
            {canEdit && <th className="px-4 py-3" />}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {rows.map((m) => (
            <tr key={m.id} className={`hover:bg-gray-50/60 ${m.isActive ? "" : "opacity-60"}`}>
              <td className="px-4 py-2.5 font-medium text-gray-900 whitespace-nowrap">
                {m.lastName}
                {!m.isActive && (
                  <span className="ml-2 rounded-full bg-gray-100 px-2 py-0.5 text-xs font-normal text-gray-500">Inactive</span>
                )}
              </td>
              <td className="px-4 py-2.5 text-gray-900 whitespace-nowrap">
                {m.firstName}
                {m.middleInitial && ` ${m.middleInitial}.`}
                {m.nickname && <span className="text-gray-400"> ({m.nickname})</span>}
              </td>
              <td className="px-4 py-2.5 text-gray-600 whitespace-nowrap">{m.mobileNumber || "—"}</td>
              <td className="px-4 py-2.5 text-gray-600 whitespace-nowrap">{m.serviceAttending ?? "—"}</td>
              <td className="px-4 py-2.5 text-gray-600 whitespace-nowrap">
                {m.vglName ?? "—"}
                {m.vglName && m.vglId === null && (
                  <span className="text-stm-amber" title="Typed in, not linked to the VGL list">
                    {" "}
                    *
                  </span>
                )}
              </td>
              <td className="px-4 py-2.5 text-gray-600 whitespace-nowrap">{m.lifestage ?? "—"}</td>
              <td className="px-4 py-2.5 text-gray-600">{m.age ?? "—"}</td>
              <td className="px-4 py-2.5">
                <div className="flex flex-wrap gap-1">
                  {m.ministries.map((ministry) => (
                    <span key={ministry} className="rounded-full bg-stm-navy/10 px-2 py-0.5 text-xs text-stm-navy whitespace-nowrap">
                      <MinistryName ministry={ministry} />
                    </span>
                  ))}
                </div>
              </td>
              {canEdit && (
                <td className="px-4 py-2.5 text-right whitespace-nowrap">
                  <Link href={`/members/${m.id}/edit`} className="text-stm-navy hover:underline">
                    Edit
                  </Link>
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
