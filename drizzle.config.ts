import { config } from "dotenv";
import type { Config } from "drizzle-kit";

config({ path: ".env.local" });

export default {
  // Only our own tables. v-1's victory_group_leaders (read for the VGL autocomplete) is
  // declared in src/db/v1.ts, outside this path, so drizzle-kit never sees it.
  schema: "./src/db/schema/index.ts",
  out: "./drizzle",
  dialect: "postgresql",
  // This app shares its database with v-1 (and v-4). Scope drizzle-kit to our own
  // `stm_*` tables so push/generate never tries to drop or alter anyone else's tables,
  // and keep our migration history in its own table.
  tablesFilter: ["stm_*"],
  migrations: {
    table: "__stm_drizzle_migrations",
  },
  dbCredentials: {
    // Use direct (unpooled) connection for migrations — pooler doesn't support DDL
    url: process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL!,
    ssl: process.env.NODE_ENV === "production" || !!process.env.DATABASE_URL_UNPOOLED,
  },
} satisfies Config;
