ALTER TABLE "orgs" ADD COLUMN "invite_code" text NOT NULL;--> statement-breakpoint
ALTER TABLE "orgs" ADD CONSTRAINT "orgs_invite_code_unique" UNIQUE("invite_code");