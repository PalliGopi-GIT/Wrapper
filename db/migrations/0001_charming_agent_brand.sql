CREATE TABLE "deck_exports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"deck_id" uuid NOT NULL,
	"owner_id" text NOT NULL,
	"object_key" text NOT NULL,
	"format" text DEFAULT 'pptx' NOT NULL,
	"byte_size" bigint DEFAULT 0 NOT NULL,
	"meta" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "deck_exports_object_key_unique" UNIQUE("object_key")
);
--> statement-breakpoint
ALTER TABLE "deck_exports" ADD CONSTRAINT "deck_exports_deck_id_decks_id_fk" FOREIGN KEY ("deck_id") REFERENCES "public"."decks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deck_exports" ADD CONSTRAINT "deck_exports_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "deck_exports_owner_idx" ON "deck_exports" USING btree ("owner_id","created_at");