import { asc, desc } from "drizzle-orm";
import { db } from "@/db";
import { leaders, staff } from "@/db/schema";
import { requireViewer } from "@/lib/access";
import { SearchBox } from "@/components/SearchBox";
import { LeadersTable, StaffTable } from "./PeopleTables";

// The leaders without a serve team and the pastors & staff (first imported from the
// appreciation night masterlist). Not limited by service group, like events. Admins can add
// and edit; everyone else just views.

const matches = (q: string, ...values: (string | null)[]) => {
  const tokens = q.toLowerCase().split(/\s+/).filter(Boolean);
  const haystack = values.join(" ").toLowerCase();
  return tokens.every((t) => haystack.includes(t));
};

export default async function LeadersPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const viewer = await requireViewer();
  const q = ((await searchParams).q ?? "").trim();

  const [leaderRows, staffRows] = await Promise.all([
    db.select().from(leaders).orderBy(desc(leaders.isActive), asc(leaders.lastName), asc(leaders.firstName)),
    db.select().from(staff).orderBy(desc(staff.isActive), asc(staff.lastName), asc(staff.firstName)),
  ]);
  const shownLeaders = leaderRows.filter((l) =>
    matches(q, l.firstName, l.lastName, l.nickname, l.vgLeaderName, l.serviceGroup, l.isEnc ? "ENC" : "")
  );
  const shownStaff = staffRows.filter((s) => matches(q, s.firstName, s.lastName, s.nickname, s.ministry));
  // Suggestions for the ministry field when adding/editing staff
  const staffMinistries = [...new Set(staffRows.map((s) => s.ministry))].sort();

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-stone-900">Leaders & Staff</h1>
        <p className="text-sm text-stone-500">
          Leaders without a serve team and pastors & staff — invited to events and checked in there alongside STMs.
        </p>
      </div>

      <SearchBox defaultValue={q} placeholder="Search by name, ministry, service or VG leader…" />

      <LeadersTable rows={shownLeaders} total={leaderRows.length} canEdit={viewer.canManageMembers} />
      <StaffTable rows={shownStaff} total={staffRows.length} canEdit={viewer.canManageMembers} ministries={staffMinistries} />
    </div>
  );
}
