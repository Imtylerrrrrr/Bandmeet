CREATE TABLE "chat_bindings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"room_name" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "chat_bindings_room_name_unique" UNIQUE("room_name")
);
--> statement-breakpoint
ALTER TABLE "chat_bindings" ADD CONSTRAINT "chat_bindings_org_id_orgs_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."orgs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
-- ── RLS (백스톱) ──
ALTER TABLE public.chat_bindings ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY chat_bindings_select ON public.chat_bindings FOR SELECT TO authenticated
  USING (public.is_org_member(org_id));--> statement-breakpoint
CREATE POLICY chat_bindings_admin ON public.chat_bindings FOR ALL TO authenticated
  USING (public.is_org_admin(org_id)) WITH CHECK (public.is_org_admin(org_id));
