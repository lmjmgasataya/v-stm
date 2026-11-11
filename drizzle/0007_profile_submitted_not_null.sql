-- Profile is just Submitted / Not yet: anything not recorded counts as Not yet
UPDATE "stm_members" SET "profile_submitted" = false WHERE "profile_submitted" IS NULL;--> statement-breakpoint
ALTER TABLE "stm_members" ALTER COLUMN "profile_submitted" SET DEFAULT false;--> statement-breakpoint
ALTER TABLE "stm_members" ALTER COLUMN "profile_submitted" SET NOT NULL;
