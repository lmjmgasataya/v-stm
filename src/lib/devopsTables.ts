import { getTableName } from "drizzle-orm";
import type { PgTable } from "drizzle-orm/pg-core";
import { checkIns, eventCheckIns, events, members, settings, users } from "@/db/schema";

export interface DevopsTable {
  /** Postgres table name (`stm_…`) — also the export route's `?table=` value. */
  name: string;
  label: string;
  table: PgTable;
  /** Columns (Drizzle property names) left out of the CSV export — secrets. */
  omit: string[];
}

// Typed so a misspelled `omit` column is a compile error rather than a silently exported secret
function entry<T extends PgTable>(table: T, label: string, omit: (keyof T["$inferSelect"] & string)[] = []): DevopsTable {
  return { name: getTableName(table), label, table, omit };
}

/**
 * Every `stm_*` table this app owns, grouped by area. Drives /devops-admin: the Database size
 * list on the Overview, the Data page (row counts + CSV export) and its export route.
 * Add a new `stm_` table here when it's added to the schema. v-1's `victory_group_leaders`
 * (src/db/v1.ts) is not ours and is deliberately left out.
 */
export const DEVOPS_TABLE_GROUPS: { area: string; tables: DevopsTable[] }[] = [
  {
    area: "Members",
    tables: [entry(members, "Members (STMs)")],
  },
  {
    area: "Service check-in",
    tables: [entry(checkIns, "Service check-ins")],
  },
  {
    area: "Events",
    tables: [entry(events, "Events"), entry(eventCheckIns, "Event check-ins")],
  },
  {
    area: "Staff & settings",
    tables: [entry(users, "Users (no password hashes)", ["passwordHash"]), entry(settings, "Settings")],
  },
];

export const DEVOPS_TABLES: DevopsTable[] = DEVOPS_TABLE_GROUPS.flatMap((g) => g.tables);
