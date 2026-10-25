import Link from "next/link";
import { count, getTableColumns, sql } from "drizzle-orm";
import { db } from "@/db";
import { members } from "@/db/schema";
import { requireViewer } from "@/lib/access";
import { daysServedSql, lastServedSql } from "@/lib/activity";
import { describeActivityRule } from "@/lib/activity-rule";
import { getActivityRule } from "@/lib/settings";
import { MINISTRY_OPTIONS, ministryLabel } from "@/lib/constants";
import { SearchBox } from "@/components/SearchBox";
import { primaryBtnCls, secondaryBtnCls } from "@/components/form";
import { FilterSelect } from "./FilterSelect";
import { ImportMembersModal } from "./ImportMembersModal";
import { MembersTable } from "./MembersTable";
import { Pagination } from "./Pagination";
import { PAGE_SIZE, memberListOrder, memberListQuery, memberListWhere, parseMemberListParams } from "./query";
import { ServiceMultiSelect } from "./ServiceMultiSelect";

export default async function MembersPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const viewer = await requireViewer();
  const rule = await getActivityRule();
  const p = parseMemberListParams(await searchParams, viewer);
  const where = memberListWhere(p, viewer, rule);

  const [{ total }] = await db.select({ total: count() }).from(members).where(where);
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const page = Math.min(p.page, pageCount); // a stale ?page= past the end shows the last page

  const rows = await db
    .select({
      ...getTableColumns(members),
      // Only needed (and only shown) while the activity rule is on
      lastServed: rule.enabled ? lastServedSql : sql<null>`null`,
      daysServed: rule.enabled ? daysServedSql(rule) : sql<null>`null`,
    })
    .from(members)
    .where(where)
    .orderBy(...memberListOrder(p))
    .limit(PAGE_SIZE)
    .offset((page - 1) * PAGE_SIZE);

  const filtered = p.q.trim() || p.ministry || p.services.length > 0 || p.status !== "active";
  const from = total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const to = (page - 1) * PAGE_SIZE + rows.length;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-stone-900">Service team members</h1>
        {viewer.canManageMembers && (
          <div className="flex flex-wrap justify-end gap-2">
            {/* Everything matching the current filters, every page — same columns as the import template */}
            <a
              href={`/members/export?${memberListQuery(p)}`}
              download
              aria-disabled={total === 0}
              className={`${secondaryBtnCls} ${total === 0 ? "pointer-events-none opacity-50" : ""}`}
            >
              Export to Excel
            </a>
            <ImportMembersModal services={viewer.services} scoped={!!viewer.serviceGroup} />
            <Link href="/members/new" className={primaryBtnCls}>
              + Add STM
            </Link>
          </div>
        )}
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <SearchBox defaultValue={p.q} placeholder="Search name, nickname, mobile, email, VGL…" />
        <FilterSelect
          param="ministry"
          value={p.ministry}
          label="All ministries"
          options={MINISTRY_OPTIONS}
          optionLabels={Object.fromEntries(MINISTRY_OPTIONS.map((m) => [m, ministryLabel(m)]))}
        />
        {viewer.services.length > 1 && (
          <ServiceMultiSelect
            options={viewer.services}
            selected={p.services}
            allLabel={viewer.serviceGroup ? `All ${viewer.serviceGroup}` : "All services"}
          />
        )}
        <FilterSelect
          param="status"
          value={p.status === "active" ? "" : p.status}
          label="Active"
          options={["inactive", "all"]}
          optionLabels={{ inactive: "Inactive", all: "Active & inactive" }}
        />
      </div>

      <p className="text-sm text-stone-500">
        {total > PAGE_SIZE ? `Showing ${from}–${to} of ${total.toLocaleString()}` : total} member{total === 1 ? "" : "s"}
        {filtered && " matching"}
        {rule.enabled && p.status !== "all" && (
          <span className="text-stone-400"> · Active = {describeActivityRule(rule).toLowerCase()}</span>
        )}
      </p>

      <MembersTable rows={rows} sort={p.sort} dir={p.dir} canEdit={viewer.canManageMembers} activity={rule.enabled ? rule : null} />

      <Pagination page={page} pageCount={pageCount} query={memberListQuery(p)} />
    </div>
  );
}
