import { pgTable, integer, text, boolean, timestamp } from "drizzle-orm/pg-core";

// Read-only view of v-1's table, used for the VGL autocomplete. Lives outside
// src/db/schema so drizzle-kit (scoped to `stm_*` anyway) never tries to manage it.
// Only the columns we read are declared. Never write to it from this app.
export const v1VictoryGroupLeaders = pgTable("victory_group_leaders", {
  id: integer("id").primaryKey(),
  lastName: text("last_name").notNull(),
  firstName: text("first_name").notNull(),
  nickname: text("nickname"),
  serviceAttending: text("service_attending"),
  isActive: boolean("is_active").notNull(),
  deletedAt: timestamp("deleted_at"),
});
