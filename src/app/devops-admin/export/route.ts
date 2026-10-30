import { NextResponse, type NextRequest } from "next/server";
import { getTableColumns } from "drizzle-orm";
import { db } from "@/db";
import { getViewer } from "@/lib/access";
import { toCsv } from "@/lib/csv";
import { manilaDateString } from "@/lib/date";
import { DEVOPS_TABLES } from "@/lib/devopsTables";

function csvCell(value: unknown): string | number | null {
  if (value == null) return null;
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.join("; "); // ministries, as in the members Excel export
  if (typeof value === "object") return JSON.stringify(value); // jsonb settings
  if (typeof value === "number") return value;
  return String(value);
}

/**
 * CSV of one whole `stm_*` table from the registry (`?table=stm_members`). Super admins only,
 * and not limited by service group. Columns in the entry's `omit` (secrets) are never selected.
 */
export async function GET(req: NextRequest) {
  const viewer = await getViewer();
  if (!viewer) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!viewer.isSuperAdmin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const entry = DEVOPS_TABLES.find((t) => t.name === req.nextUrl.searchParams.get("table"));
  if (!entry) return NextResponse.json({ error: "Unknown table" }, { status: 400 });

  const columns = Object.fromEntries(
    Object.entries(getTableColumns(entry.table)).filter(([key]) => !entry.omit.includes(key))
  );
  const rows = (await db.select(columns).from(entry.table)) as Record<string, unknown>[];
  // Header uses the database column names, so the file matches the table as stored
  const header = Object.values(columns).map((c) => c.name);
  const keys = Object.keys(columns);
  const csv = toCsv([header, ...rows.map((row) => keys.map((k) => csvCell(row[k])))]);

  // BOM so Excel opens it as UTF-8 (names with ñ etc.)
  return new NextResponse("﻿" + csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${entry.name}-${manilaDateString()}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
