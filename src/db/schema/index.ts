import { pgTable, serial, text, boolean, timestamp, integer, date, uniqueIndex, index, jsonb, check } from "drizzle-orm/pg-core";
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
    // "Submitted the Service Team Members Profile?" — Submitted (true) or Not yet (false)
    profileSubmitted: boolean("profile_submitted").notNull().default(false),
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

// Leaders who aren't on a serve team (invited to events, but not STMs). `isEnc` marks the
// ENC leaders, counted as their own row in event summaries.
export const leaders = pgTable(
  "stm_leaders",
  {
    id: serial("id").primaryKey(),
    lastName: text("last_name").notNull(),
    firstName: text("first_name").notNull(),
    nickname: text("nickname"),
    // A SERVICE_GROUPS key ("9AM & 11AM"); null = unknown
    serviceGroup: text("service_group"),
    isEnc: boolean("is_enc").notNull().default(false),
    // Their own Victory Group leader, as written in the masterlist
    vgLeaderName: text("vg_leader_name"),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("stm_leaders_person_uq").on(sql`lower(${t.lastName})`, sql`lower(${t.firstName})`)]
);

// Pastors, their wives and church staff. `ministry` is free text with its own values
// ("Pastor", "Pastor's Wife", "Admin", "Maintenance", …), unrelated to MINISTRY_OPTIONS.
export const staff = pgTable(
  "stm_staff",
  {
    id: serial("id").primaryKey(),
    // '' when unknown (some staff go by one name)
    lastName: text("last_name").notNull().default(""),
    firstName: text("first_name").notNull(),
    nickname: text("nickname"),
    ministry: text("ministry").notNull(),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("stm_staff_person_uq").on(sql`lower(${t.lastName})`, sql`lower(${t.firstName})`)]
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
    // On: check-in lists the people pre-registered as attending (stm_event_registrations);
    // anyone else can still be checked in, tagged as a walk-in.
    preRegistration: boolean("pre_registration").notNull().default(false),
    // Who's invited (the pre-registration list): SERVICE_GROUPS keys — STMs and leaders of these
    // services ([] = every service) — and which kinds of people (PersonKind: stm / leader / staff).
    audienceGroups: text("audience_groups").array().notNull().default(sql`'{}'::text[]`),
    audienceKinds: text("audience_kinds").array().notNull().default(sql`'{stm,leader,staff}'::text[]`),
    createdById: integer("created_by_id").references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("stm_events_date_idx").on(t.eventDate)]
);

// Exactly one of memberId / leaderId / staffId is set (an STM, a leader, or a pastor/staff).
const onePerson = (t: { memberId: unknown; leaderId: unknown; staffId: unknown }, name: string) =>
  check(name, sql`num_nonnulls(${t.memberId}, ${t.leaderId}, ${t.staffId}) = 1`);

// Who was invited to a pre-registration event and their RSVP ("I will attend": YES/NO).
export const eventRegistrations = pgTable(
  "stm_event_registrations",
  {
    id: serial("id").primaryKey(),
    eventId: integer("event_id")
      .notNull()
      .references(() => events.id, { onDelete: "cascade" }),
    memberId: integer("member_id").references(() => members.id, { onDelete: "cascade" }),
    leaderId: integer("leader_id").references(() => leaders.id, { onDelete: "cascade" }),
    staffId: integer("staff_id").references(() => staff.id, { onDelete: "cascade" }),
    // true = will attend (pre-registered); false = replied no
    attending: boolean("attending").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    onePerson(t, "stm_event_registrations_one_person"),
    uniqueIndex("stm_event_registrations_member_uq").on(t.eventId, t.memberId).where(sql`${t.memberId} is not null`),
    uniqueIndex("stm_event_registrations_leader_uq").on(t.eventId, t.leaderId).where(sql`${t.leaderId} is not null`),
    uniqueIndex("stm_event_registrations_staff_uq").on(t.eventId, t.staffId).where(sql`${t.staffId} is not null`),
  ]
);

// Kept apart from stm_check_ins so service attendance numbers aren't mixed with events.
export const eventCheckIns = pgTable(
  "stm_event_check_ins",
  {
    id: serial("id").primaryKey(),
    eventId: integer("event_id")
      .notNull()
      .references(() => events.id, { onDelete: "cascade" }),
    memberId: integer("member_id").references(() => members.id, { onDelete: "cascade" }),
    leaderId: integer("leader_id").references(() => leaders.id, { onDelete: "cascade" }),
    staffId: integer("staff_id").references(() => staff.id, { onDelete: "cascade" }),
    // Pre-registration events only: checked in without being pre-registered as attending
    isWalkIn: boolean("is_walk_in").notNull().default(false),
    checkedInAt: timestamp("checked_in_at", { withTimezone: true }).notNull().defaultNow(),
    checkedInById: integer("checked_in_by_id").references(() => users.id, { onDelete: "set null" }),
  },
  (t) => [
    onePerson(t, "stm_event_check_ins_one_person"),
    // Postgres treats NULLs as distinct, so each index only constrains its own kind of person
    uniqueIndex("stm_event_check_ins_event_member_uq").on(t.eventId, t.memberId),
    uniqueIndex("stm_event_check_ins_event_leader_uq").on(t.eventId, t.leaderId),
    uniqueIndex("stm_event_check_ins_event_staff_uq").on(t.eventId, t.staffId),
  ]
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
export type Leader = typeof leaders.$inferSelect;
export type Staff = typeof staff.$inferSelect;
