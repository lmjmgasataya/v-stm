-- STM status: active | pending (added by a volunteer, awaiting an admin's approval) | inactive.
-- is_active stays as a mirror of it (status = 'active'), enforced by the check.
ALTER TABLE "stm_members" ADD COLUMN "status" text DEFAULT 'active' NOT NULL;--> statement-breakpoint
UPDATE "stm_members" SET "status" = 'inactive' WHERE NOT "is_active";--> statement-breakpoint
ALTER TABLE "stm_members" ADD CONSTRAINT "stm_members_status_active" CHECK ("stm_members"."is_active" = ("stm_members"."status" = 'active'));
