CREATE TABLE "stm_event_registrations" (
	"id" serial PRIMARY KEY NOT NULL,
	"event_id" integer NOT NULL,
	"member_id" integer,
	"leader_id" integer,
	"staff_id" integer,
	"attending" boolean NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "stm_event_registrations_one_person" CHECK (num_nonnulls("stm_event_registrations"."member_id", "stm_event_registrations"."leader_id", "stm_event_registrations"."staff_id") = 1)
);
--> statement-breakpoint
CREATE TABLE "stm_leaders" (
	"id" serial PRIMARY KEY NOT NULL,
	"last_name" text NOT NULL,
	"first_name" text NOT NULL,
	"nickname" text,
	"service_group" text,
	"is_enc" boolean DEFAULT false NOT NULL,
	"vg_leader_name" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "stm_staff" (
	"id" serial PRIMARY KEY NOT NULL,
	"last_name" text DEFAULT '' NOT NULL,
	"first_name" text NOT NULL,
	"nickname" text,
	"ministry" text NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "stm_event_check_ins" ALTER COLUMN "member_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "stm_event_check_ins" ADD COLUMN "leader_id" integer;--> statement-breakpoint
ALTER TABLE "stm_event_check_ins" ADD COLUMN "staff_id" integer;--> statement-breakpoint
ALTER TABLE "stm_event_check_ins" ADD COLUMN "is_walk_in" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "stm_events" ADD COLUMN "pre_registration" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "stm_members" ADD COLUMN "profile_submitted" boolean;--> statement-breakpoint
ALTER TABLE "stm_event_registrations" ADD CONSTRAINT "stm_event_registrations_event_id_stm_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."stm_events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stm_event_registrations" ADD CONSTRAINT "stm_event_registrations_member_id_stm_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."stm_members"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stm_event_registrations" ADD CONSTRAINT "stm_event_registrations_leader_id_stm_leaders_id_fk" FOREIGN KEY ("leader_id") REFERENCES "public"."stm_leaders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stm_event_registrations" ADD CONSTRAINT "stm_event_registrations_staff_id_stm_staff_id_fk" FOREIGN KEY ("staff_id") REFERENCES "public"."stm_staff"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "stm_event_registrations_member_uq" ON "stm_event_registrations" USING btree ("event_id","member_id") WHERE "stm_event_registrations"."member_id" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "stm_event_registrations_leader_uq" ON "stm_event_registrations" USING btree ("event_id","leader_id") WHERE "stm_event_registrations"."leader_id" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "stm_event_registrations_staff_uq" ON "stm_event_registrations" USING btree ("event_id","staff_id") WHERE "stm_event_registrations"."staff_id" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "stm_leaders_person_uq" ON "stm_leaders" USING btree (lower("last_name"),lower("first_name"));--> statement-breakpoint
CREATE UNIQUE INDEX "stm_staff_person_uq" ON "stm_staff" USING btree (lower("last_name"),lower("first_name"));--> statement-breakpoint
ALTER TABLE "stm_event_check_ins" ADD CONSTRAINT "stm_event_check_ins_leader_id_stm_leaders_id_fk" FOREIGN KEY ("leader_id") REFERENCES "public"."stm_leaders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stm_event_check_ins" ADD CONSTRAINT "stm_event_check_ins_staff_id_stm_staff_id_fk" FOREIGN KEY ("staff_id") REFERENCES "public"."stm_staff"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "stm_event_check_ins_event_leader_uq" ON "stm_event_check_ins" USING btree ("event_id","leader_id");--> statement-breakpoint
CREATE UNIQUE INDEX "stm_event_check_ins_event_staff_uq" ON "stm_event_check_ins" USING btree ("event_id","staff_id");--> statement-breakpoint
ALTER TABLE "stm_event_check_ins" ADD CONSTRAINT "stm_event_check_ins_one_person" CHECK (num_nonnulls("stm_event_check_ins"."member_id", "stm_event_check_ins"."leader_id", "stm_event_check_ins"."staff_id") = 1);--> statement-breakpoint
-- Service attending is now the member's service group, not a single time slot
UPDATE "stm_members" SET "service_attending" = CASE "service_attending"
	WHEN '9AM - Mandurriao' THEN '9AM & 11AM - Mandurriao'
	WHEN '11AM - Mandurriao' THEN '9AM & 11AM - Mandurriao'
	WHEN '2PM - Mandurriao' THEN '2PM & 4PM - Mandurriao'
	WHEN '4PM - Mandurriao' THEN '2PM & 4PM - Mandurriao'
	WHEN '10AM - Lapaz' THEN '10AM & 1PM - Lapaz'
	WHEN '1PM - Lapaz' THEN '10AM & 1PM - Lapaz'
	ELSE "service_attending" END;
