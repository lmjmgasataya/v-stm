CREATE TABLE "stm_check_ins" (
	"id" serial PRIMARY KEY NOT NULL,
	"member_id" integer NOT NULL,
	"service" text NOT NULL,
	"service_date" date NOT NULL,
	"checked_in_at" timestamp with time zone DEFAULT now() NOT NULL,
	"checked_in_by_id" integer
);
--> statement-breakpoint
CREATE TABLE "stm_members" (
	"id" serial PRIMARY KEY NOT NULL,
	"last_name" text NOT NULL,
	"first_name" text NOT NULL,
	"middle_initial" text DEFAULT '' NOT NULL,
	"mobile_number" text DEFAULT '' NOT NULL,
	"facebook_messenger_name" text,
	"lifestage" text,
	"age" integer,
	"gender" text,
	"service_attending" text,
	"email" text,
	"vgl_id" integer,
	"vgl_name" text,
	"discipleship_journey_completed" text,
	"ministries" text[] DEFAULT '{}'::text[] NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "stm_users" (
	"id" serial PRIMARY KEY NOT NULL,
	"username" text NOT NULL,
	"password_hash" text NOT NULL,
	"name" text NOT NULL,
	"role" text DEFAULT 'volunteer' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "stm_users_username_unique" UNIQUE("username")
);
--> statement-breakpoint
ALTER TABLE "stm_check_ins" ADD CONSTRAINT "stm_check_ins_member_id_stm_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."stm_members"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stm_check_ins" ADD CONSTRAINT "stm_check_ins_checked_in_by_id_stm_users_id_fk" FOREIGN KEY ("checked_in_by_id") REFERENCES "public"."stm_users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "stm_check_ins_member_service_date_uq" ON "stm_check_ins" USING btree ("member_id","service_date","service");--> statement-breakpoint
CREATE INDEX "stm_check_ins_date_service_idx" ON "stm_check_ins" USING btree ("service_date","service");--> statement-breakpoint
CREATE UNIQUE INDEX "stm_members_person_uq" ON "stm_members" USING btree (lower("last_name"),lower("first_name"),"mobile_number");