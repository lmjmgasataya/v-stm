import Link from "next/link";
import { asc, sql } from "drizzle-orm";
import { db } from "@/db";
import { settings } from "@/db/schema";
import { requireSuperAdmin } from "@/lib/access";
import { formatDateTime } from "@/lib/date";
import { DEVOPS_TABLE_GROUPS, DEVOPS_TABLES } from "@/lib/devopsTables";
import { secondaryBtnCls } from "@/components/form";

// pg table name → area, for grouping the size list
const AREA_BY_TABLE = new Map(DEVOPS_TABLE_GROUPS.flatMap(({ area, tables }) => tables.map((t) => [t.name, area] as const)));
const NOT_REGISTERED = "Not in src/lib/devopsTables.ts — add it there";

// The database is shared with v-1 (and other apps), so only `stm_*` tables are listed and summed.
async function getDbSizes() {
  const [tables, totals] = await Promise.all([
    db.execute<{ table: string; size: string }>(sql`
      SELECT relname AS table, pg_size_pretty(pg_total_relation_size(relid)) AS size
      FROM pg_catalog.pg_statio_user_tables
      WHERE schemaname = 'public' AND left(relname, 4) = 'stm_'
      ORDER BY pg_total_relation_size(relid) DESC
    `),
    db.execute<{ stm_size: string; db_size: string }>(sql`
      SELECT pg_size_pretty(coalesce(sum(pg_total_relation_size(relid)), 0)) AS stm_size,
             pg_size_pretty(pg_database_size(current_database())) AS db_size
      FROM pg_catalog.pg_statio_user_tables
      WHERE schemaname = 'public' AND left(relname, 4) = 'stm_'
    `),
  ]);
  return { tables: tables.rows, ...totals.rows[0] };
}

function GroupHeading({ children, colSpan }: { children: React.ReactNode; colSpan: number }) {
  return (
    <tr>
      <td colSpan={colSpan} className="bg-stone-50 px-5 py-2 text-xs font-semibold uppercase tracking-wide text-stone-500">
        {children}
      </td>
    </tr>
  );
}

export default async function DevopsOverviewPage() {
  await requireSuperAdmin();
  const [sizes, settingRows] = await Promise.all([
    getDbSizes(),
    db.select().from(settings).orderBy(asc(settings.key)),
  ]);
  const labels = new Map(DEVOPS_TABLES.map((t) => [t.name, t.label]));

  return (
    <div className="flex flex-col gap-6">
      <section className="bg-white rounded-2xl border border-stone-200/80 shadow-sm overflow-hidden">
        <div className="flex flex-wrap items-start justify-between gap-3 px-5 py-4 border-b border-stone-100">
          <div>
            <h2 className="text-lg font-bold text-stone-900">Database</h2>
            <p className="text-sm text-stone-500">
              This app&apos;s <span className="font-mono text-xs">stm_*</span> tables, including indexes.
            </p>
          </div>
          <div className="text-right">
            <p className="text-xl font-extrabold tracking-tight text-stm-brand">{sizes.stm_size}</p>
            <p className="text-xs text-stone-400">all stm_* tables</p>
          </div>
        </div>
        <table className="w-full text-sm">
          <thead className="text-left text-xs uppercase tracking-wide text-stone-500">
            <tr>
              <th className="px-5 py-2.5 font-medium">Table</th>
              <th className="px-5 py-2.5 font-medium text-right">Size</th>
            </tr>
          </thead>
          {[...DEVOPS_TABLE_GROUPS.map((g) => g.area), NOT_REGISTERED].map((area) => {
            const rows = sizes.tables.filter((t) => (AREA_BY_TABLE.get(t.table) ?? NOT_REGISTERED) === area);
            if (rows.length === 0) return null;
            return (
              <tbody key={area} className="divide-y divide-stone-100 border-t border-stone-100">
                <GroupHeading colSpan={2}>{area}</GroupHeading>
                {rows.map((t) => (
                  <tr key={t.table} className="hover:bg-stone-50/60">
                    <td className="px-5 py-2.5">
                      <span className="font-mono text-stone-800">{t.table}</span>
                      {labels.has(t.table) && <span className="ml-2 text-xs text-stone-400">{labels.get(t.table)}</span>}
                    </td>
                    <td className="px-5 py-2.5 text-right text-stone-600 whitespace-nowrap">{t.size}</td>
                  </tr>
                ))}
              </tbody>
            );
          })}
        </table>
        <p className="px-5 py-3 border-t border-stone-100 bg-stone-50/60 text-xs text-stone-500">
          Whole database: <span className="font-semibold text-stone-700">{sizes.db_size}</span> — shared with v-1 and other
          apps, so most of it isn&apos;t this app&apos;s.
        </p>
      </section>

      <section className="bg-white rounded-2xl border border-stone-200/80 shadow-sm overflow-hidden">
        <div className="flex flex-wrap items-start justify-between gap-3 px-5 py-4 border-b border-stone-100">
          <div>
            <h2 className="text-lg font-bold text-stone-900">Settings</h2>
            <p className="text-sm text-stone-500">
              Stored values in <span className="font-mono text-xs">stm_settings</span>. A key that isn&apos;t here uses its
              default.
            </p>
          </div>
          <Link href="/settings" className={secondaryBtnCls}>
            Edit settings
          </Link>
        </div>
        {settingRows.length === 0 ? (
          <p className="px-5 py-4 text-sm text-stone-400">Nothing saved yet — every setting uses its default.</p>
        ) : (
          <ul className="divide-y divide-stone-100">
            {settingRows.map((s) => (
              <li key={s.key} className="px-5 py-3">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <p className="font-mono text-sm font-semibold text-stone-800">{s.key}</p>
                  <p className="text-xs text-stone-400">Updated {formatDateTime(s.updatedAt)}</p>
                </div>
                <pre className="mt-1.5 overflow-x-auto rounded-xl bg-stone-50 px-3 py-2 font-mono text-xs text-stone-700">
                  {JSON.stringify(s.value, null, 2)}
                </pre>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
