import { asc, desc } from "drizzle-orm";
import { db } from "@/db";
import { leaders, staff } from "@/db/schema";
import { requireViewer } from "@/lib/access";
import { SearchBox } from "@/components/SearchBox";

// Read-only lists of the leaders without a serve team and the pastors & staff (imported from
// the appreciation night masterlist). Not limited by service group, like events.

const matches = (q: string, ...values: (string | null)[]) => {
  const tokens = q.toLowerCase().split(/\s+/).filter(Boolean);
  const haystack = values.join(" ").toLowerCase();
  return tokens.every((t) => haystack.includes(t));
};

export default async function LeadersPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  await requireViewer();
  const q = ((await searchParams).q ?? "").trim();

  const [leaderRows, staffRows] = await Promise.all([
    db.select().from(leaders).orderBy(desc(leaders.isActive), asc(leaders.lastName), asc(leaders.firstName)),
    db.select().from(staff).orderBy(desc(staff.isActive), asc(staff.lastName), asc(staff.firstName)),
  ]);
  const shownLeaders = leaderRows.filter((l) => matches(q, l.firstName, l.lastName, l.nickname, l.vgLeaderName, l.serviceGroup, l.isEnc ? "ENC" : ""));
  const shownStaff = staffRows.filter((s) => matches(q, s.firstName, s.lastName, s.nickname, s.ministry));

  const name = (p: { lastName: string; firstName: string; nickname: string | null }) =>
    `${p.lastName ? `${p.lastName}, ` : ""}${p.firstName}${p.nickname ? ` (${p.nickname})` : ""}`;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-stone-900">Leaders & Staff</h1>
        <p className="text-sm text-stone-500">
          Leaders without a serve team and pastors & staff — invited to events and checked in there alongside STMs.
        </p>
      </div>

      <SearchBox defaultValue={q} placeholder="Search by name, ministry, service or VG leader…" />

      <section>
        <h2 className="text-sm font-semibold uppercase tracking-wide text-stone-500 mb-2">
          Leaders ({shownLeaders.length}
          {q ? ` of ${leaderRows.length}` : ""})
        </h2>
        <Table
          empty="No leaders found."
          headers={["Name", "Service", "ENC", "VG leader"]}
          rows={shownLeaders.map((l) => ({
            key: l.id,
            inactive: !l.isActive,
            cells: [name(l), l.serviceGroup ?? "—", l.isEnc ? "ENC" : "", l.vgLeaderName ?? "—"],
          }))}
        />
      </section>

      <section>
        <h2 className="text-sm font-semibold uppercase tracking-wide text-stone-500 mb-2">
          Pastors & staff ({shownStaff.length}
          {q ? ` of ${staffRows.length}` : ""})
        </h2>
        <Table
          empty="No pastors or staff found."
          headers={["Name", "Ministry"]}
          rows={shownStaff.map((s) => ({ key: s.id, inactive: !s.isActive, cells: [name(s), s.ministry] }))}
        />
      </section>
    </div>
  );
}

function Table({
  headers,
  rows,
  empty,
}: {
  headers: string[];
  rows: { key: number; inactive: boolean; cells: string[] }[];
  empty: string;
}) {
  if (rows.length === 0) {
    return (
      <div className="bg-white rounded-2xl border border-dashed border-stone-300 p-8 text-center text-sm text-stone-500">{empty}</div>
    );
  }
  return (
    <div className="bg-white rounded-2xl border border-stone-200/80 shadow-sm overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="bg-stone-50 text-xs uppercase tracking-wide text-stone-500">
          <tr>
            {headers.map((h) => (
              <th key={h} className="px-4 py-2.5 text-left font-semibold">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-stone-100">
          {rows.map((r) => (
            <tr key={r.key} className={r.inactive ? "text-stone-400" : "text-stone-700"}>
              {r.cells.map((c, i) => (
                <td key={i} className={`px-4 py-2.5 whitespace-nowrap ${i === 0 ? "font-medium text-stone-900" : ""}`}>
                  {c}
                  {i === 0 && r.inactive && <span className="ml-2 text-xs text-stone-400">(inactive)</span>}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
