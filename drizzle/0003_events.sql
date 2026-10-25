CREATE TABLE "stm_event_check_ins" (
	"id" serial PRIMARY KEY NOT NULL,
	"event_id" integer NOT NULL,
	"member_id" integer NOT NULL,
	"checked_in_at" timestamp with time zone DEFAULT now() NOT NULL,
	"checked_in_by_id" integer
);
--> statement-breakpoint
CREATE TABLE "stm_events" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"event_date" date NOT NULL,
	"notes" text,
	"created_by_id" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "stm_event_check_ins" ADD CONSTRAINT "stm_event_check_ins_event_id_stm_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."stm_events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stm_event_check_ins" ADD CONSTRAINT "stm_event_check_ins_member_id_stm_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."stm_members"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stm_event_check_ins" ADD CONSTRAINT "stm_event_check_ins_checked_in_by_id_stm_users_id_fk" FOREIGN KEY ("checked_in_by_id") REFERENCES "public"."stm_users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stm_events" ADD CONSTRAINT "stm_events_created_by_id_stm_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."stm_users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "stm_event_check_ins_event_member_uq" ON "stm_event_check_ins" USING btree ("event_id","member_id");--> statement-breakpoint
CREATE INDEX "stm_events_date_idx" ON "stm_events" USING btree ("event_date");