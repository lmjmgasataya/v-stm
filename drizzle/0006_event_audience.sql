ALTER TABLE "stm_events" ADD COLUMN "audience_groups" text[] DEFAULT '{}'::text[] NOT NULL;--> statement-breakpoint
ALTER TABLE "stm_events" ADD COLUMN "audience_kinds" text[] DEFAULT '{stm,leader,staff}'::text[] NOT NULL;--> statement-breakpoint
-- The 2026 appreciation nights: each invites its own services' STMs and leaders, plus all pastors & staff
UPDATE "stm_events" SET "audience_groups" = '{"9AM & 11AM"}' WHERE "name" = 'AM SERVICE TEAM MEMBERS AND LEADERS APPRECIATION NIGHT' AND "event_date" = '2026-11-20';--> statement-breakpoint
UPDATE "stm_events" SET "audience_groups" = '{"2PM & 4PM","6PM"}' WHERE "name" = 'PM and 6PM SERVICE TEAM MEMBERS AND LEADERS APPRECIATION NIGHT' AND "event_date" = '2026-11-27';--> statement-breakpoint
UPDATE "stm_events" SET "audience_groups" = '{"10AM & 1PM"}' WHERE "name" = 'LAPAZ SERVICE TEAM MEMBERS AND LEADERS APPRECIATION NIGHT' AND "event_date" = '2026-12-04';
