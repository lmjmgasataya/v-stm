import { pgTable, serial, text, boolean, timestamp, integer, date, uniqueIndex, index, jsonb } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

// Every table is prefixed `stm_` because this app shares its database with v-1.
// Enum-like columns are plain `text` on purpose: Postgres enums are database-wide
// (not table-scoped) and v-1 already owns names like `lifestage`.

export const users = pgTable("stm_users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  name: text("name").notNull(),
  role: text("role").notNull().default("volunteer"), // "admin" | "volunteer"
  // A SERVICE_GROUPS key ("2PM & 4PM"); null = every service. See src/lib/access.ts.
  serviceGroup: text("service_group"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const members = pgTable(
  "stm_members",
  {
    id: serial("id").primaryKey(),
    lastName: text("last_name").notNull(),
    firstName: text("first_name").notNull(),
    middleInitial: text("middle_initial").notNull().default(""),
    nickname: text("nickname"),
    // '' when unknown, never null, so the dedup index below treats blanks alike
    mobileNumber: text("mobile_number").notNull().default(""),
    facebookMessengerName: text("facebook_messenger_name"),
    lifestage: text("lifestage"),
    age: integer("age"),
    gender: text("gender"), // "Male" | "Female"
    serviceAttending: text("service_attending"),
    email: text("email"),
    // v-1 victory_group_leaders.id when picked from the autocomplete. No FK: v-1 owns
    // that table (and merges/deletes leaders), so a constraint would block v-1.
    vglId: integer("vgl_id"),
    // Display name of the VGL — the picked leader's name, or free text when they aren't in v-1
    vglName: text("vgl_name"),
    // Comma-joined DISCIPLESHIP_JOURNEY_STEPS, same format as v-1's victory_group_leaders
    discipleshipJourneyCompleted: text("discipleship_journey_completed"),
    ministries: text("ministries").array().notNull().default(sql`'{}'::text[]`),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("stm_members_person_uq").on(sql`lower(${t.lastName})`, sql`lower(${t.firstName})`, t.mobileNumber),
  ]
);

// One row per member per service per day.
export const checkIns = pgTable(
  "stm_check_ins",
  {
    id: serial("id").primaryKey(),
    memberId: integer("member_id")
      .notNull()
      .references(() => members.id, { onDelete: "cascade" }),
    service: text("service").notNull(),
    // Manila calendar date of the service (YYYY-MM-DD)
    serviceDate: date("service_date").notNull(),
    checkedInAt: timestamp("checked_in_at", { withTimezone: true }).notNull().defaultNow(),
    checkedInById: integer("checked_in_by_id").references(() => users.id, { onDelete: "set null" }),
  },
  (t) => [
    uniqueIndex("stm_check_ins_member_service_date_uq").on(t.memberId, t.serviceDate, t.service),
    index("stm_check_ins_date_service_idx").on(t.serviceDate, t.service),
  ]
);

// Custom events outside the usual services (e.g. a weekday prayer night). Shared by every
// staff user; each one only sees and checks in members within their own services.
export const events = pgTable(
  "stm_events",
  {
    id: serial("id").primaryKey(),
    name: text("name").notNull(),
    // Manila calendar date (YYYY-MM-DD)
    eventDate: date("event_date").notNull(),
    notes: text("notes"),
    createdById: integer("created_by_id").references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("stm_events_date_idx").on(t.eventDate)]
);

// Kept apart from stm_check_ins so service attendance numbers aren't mixed with events.
export const eventCheckIns = pgTable(
  "stm_event_check_ins",
  {
    id: serial("id").primaryKey(),
    eventId: integer("event_id")
      .notNull()
      .references(() => events.id, { onDelete: "cascade" }),
    memberId: integer("member_id")
      .notNull()
      .references(() => members.id, { onDelete: "cascade" }),
    checkedInAt: timestamp("checked_in_at", { withTimezone: true }).notNull().defaultNow(),
    checkedInById: integer("checked_in_by_id").references(() => users.id, { onDelete: "set null" }),
  },
  (t) => [uniqueIndex("stm_event_check_ins_event_member_uq").on(t.eventId, t.memberId)]
);

// Global app settings, one JSON value per key (e.g. "activity_rule"). Read through
// src/lib/settings.ts, which normalizes the stored shape and supplies defaults.
export const settings = pgTable("stm_settings", {
  key: text("key").primaryKey(),
  value: jsonb("value").notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export type User = typeof users.$inferSelect;
export type Member = typeof members.$inferSelect;
export type CheckIn = typeof checkIns.$inferSelect;
export type Event = typeof events.$inferSelect;
