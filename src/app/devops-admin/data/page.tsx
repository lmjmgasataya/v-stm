import { sql } from "drizzle-orm";
import { db } from "@/db";
import { requireSuperAdmin } from "@/lib/access";
import { DEVOPS_TABLE_GROUPS, DEVOPS_TABLES } from "@/lib/devopsTables";
import { secondaryBtnCls } from "@/components/form";

// One round trip for every table's row count (UNION ALL) instead of a query per table.
async function getRowCounts(): Promise<Record<string, number>> {
  const result = await db.execute<{ name: string; c: number }>(
    sql.join(
      DEVOPS_TABLES.map((t) => sql`SELECT ${t.name}::text AS name, count(*)::int AS c FROM ${t.table}`),
      sql` UNION ALL `
    )
  );
  return Object.fromEntries(result.rows.map((r) => [r.name, r.c]));
}

export default async function DevopsDataPage() {
  await requireSuperAdmin();
  const counts = await getRowCounts();

  return (
    <section className="bg-white rounded-2xl border border-stone-200/80 shadow-sm overflow-hidden">
      <div className="px-5 py-4 border-b border-stone-100">
        <h2 className="text-lg font-bold text-stone-900">Export CSV</h2>
        <p className="text-sm text-stone-500 mt-1">
          A full CSV of each table, current at the time of download. Exports are <strong>not</strong> limited by service
          group — every row from every service. Password hashes are left out.
        </p>
      </div>
      {DEVOPS_TABLE_GROUPS.map(({ area, tables }) => (
        <div key={area}>
          <p className="bg-stone-50 px-5 py-2 border-y border-stone-100 text-xs font-semibold uppercase tracking-wide text-stone-500">
            {area}
          </p>
          <ul className="divide-y divide-stone-100">
            {tables.map(({ name, label }) => (
              <li key={name} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3">
                <div className="min-w-0">
                  <p className="font-semibold text-stone-800">{label}</p>
                  <p className="text-xs text-stone-400">
                    <span className="font-mono">{name}</span> · {(counts[name] ?? 0).toLocaleString()} rows
                  </p>
                </div>
                <a href={`/devops-admin/export?table=${name}`} download className={secondaryBtnCls}>
                  Download CSV
                </a>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </section>
  );
}
