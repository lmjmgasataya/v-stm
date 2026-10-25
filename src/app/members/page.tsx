import Link from "next/link";
import { and, arrayContains, asc, eq, getTableColumns, ilike, or, sql, type SQL } from "drizzle-orm";
import { db } from "@/db";
import { members } from "@/db/schema";
import { memberScope, requireViewer } from "@/lib/access";
import { activeMemberCondition, daysServedSql, inactiveMemberCondition, lastServedSql } from "@/lib/activity";
import { describeActivityRule } from "@/lib/activity-rule";
import { getActivityRule } from "@/lib/settings";
import { MINISTRY_OPTIONS, SERVICE_OPTIONS, ministryLabel } from "@/lib/constants";
import { parseSort } from "@/lib/sort";
import { SearchBox } from "@/components/SearchBox";
import { primaryBtnCls } from "@/components/form";
import { FilterSelect } from "./FilterSelect";
import { ImportMembersModal } from "./ImportMembersModal";
import { MembersTable } from "./MembersTable";
import { MEMBER_SORT_COLUMNS } from "./sortColumns";

type Status = "active" | "inactive" | "all";

export default async function MembersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; ministry?: string; service?: string; status?: string; sort?: string; dir?: string }>;
}) {
  const viewer = await requireViewer();
  const rule = await getActivityRule();

  const sp = await searchParams;
  const q = sp.q ?? "";
  const ministry = (MINISTRY_OPTIONS as readonly string[]).includes(sp.ministry ?? "") ? sp.ministry! : "";
  const service = viewer.services.includes(sp.service ?? "") ? sp.service! : "";
  const status: Status = sp.status === "inactive" || sp.status === "all" ? sp.status : "active";

  // Service-group users only ever see their own services' members
  const conditions: (SQL | undefined)[] = [memberScope(viewer)];
  const term = q.trim();
  // Every word must match some column, so "Jun Dela Cruz" (nickname + last name) or
  // "Juan Dela Cruz" finds the member even though no single column holds the whole phrase
  for (const word of term.split(/\s+/).filter(Boolean)) {
    const like = `%${word.replace(/[\\%_]/g, "\\$&")}%`;
    conditions.push(
      or(
        ilike(members.firstName, like),
        ilike(members.nickname, like),
        ilike(members.lastName, like),
        ilike(members.mobileNumber, like),
        ilike(members.email, like),
        ilike(members.vglName, like)
      )
    );
  }
  if (ministry) conditions.push(arrayContains(members.ministries, [ministry]));
  if (service) conditions.push(eq(members.serviceAttending, service));
  // Active/Inactive follow the activity rule when it's on (Settings), else the roster flag
  if (status === "active") conditions.push(activeMemberCondition(rule));
  if (status === "inactive") conditions.push(inactiveMemberCondition(rule));

  const { sort, dir } = parseSort(sp.sort, sp.dir, MEMBER_SORT_COLUMNS, "lastName");
  const column = members[sort];
  const direction = dir === "asc" ? sql`asc` : sql`desc`;
  // Service sorts by time slot order (SERVICE_OPTIONS)
  const primary =
    sort === "serviceAttending"
      ? sql`array_position(ARRAY[${sql.join(
          SERVICE_OPTIONS.map((s) => sql`${s}`),
          sql`, `
        )}]::text[], ${column})`
      : column;
  // mobileNumber stores '' for unknown, so treat it as blank too
  const blank = sort === "mobileNumber" ? sql`nullif(${column}, '')` : column;

  const rows = await db
    .select({
      ...getTableColumns(members),
      // Only needed (and only shown) while the activity rule is on
      lastServed: rule.enabled ? lastServedSql : sql<null>`null`,
      daysServed: rule.enabled ? daysServedSql(rule) : sql<null>`null`,
    })
    .from(members)
    .where(and(...conditions))
    .orderBy(
      sql`${blank} is null`, // blanks always last, whichever direction
      sql`${primary} ${direction}`,
      asc(members.lastName),
      asc(members.firstName)
    );

  const filtered = term || ministry || service || status !== "active";

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-stone-900">Service team members</h1>
        {viewer.canManageMembers && (
          <div className="flex gap-2">
            <ImportMembersModal services={viewer.services} scoped={!!viewer.serviceGroup} />
            <Link href="/members/new" className={primaryBtnCls}>
              + Add STM
            </Link>
          </div>
        )}
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <SearchBox defaultValue={q} placeholder="Search name, nickname, mobile, email, VGL…" />
        <FilterSelect
          param="ministry"
          value={ministry}
          label="All ministries"
          options={MINISTRY_OPTIONS}
          optionLabels={Object.fromEntries(MINISTRY_OPTIONS.map((m) => [m, ministryLabel(m)]))}
        />
        {viewer.services.length > 1 && (
          <FilterSelect
            param="service"
            value={service}
            label={viewer.serviceGroup ? `All ${viewer.serviceGroup}` : "All services"}
            options={viewer.services}
          />
        )}
        <FilterSelect
          param="status"
          value={status === "active" ? "" : status}
          label="Active"
          options={["inactive", "all"]}
          optionLabels={{ inactive: "Inactive", all: "Active & inactive" }}
        />
      </div>

      <p className="text-sm text-stone-500">
        {rows.length} member{rows.length === 1 ? "" : "s"}
        {filtered && " matching"}
        {rule.enabled && status !== "all" && (
          <span className="text-stone-400"> · Active = {describeActivityRule(rule).toLowerCase()}</span>
        )}
      </p>

      <MembersTable rows={rows} sort={sort} dir={dir} canEdit={viewer.canManageMembers} activity={rule.enabled ? rule : null} />
    </div>
  );
}
