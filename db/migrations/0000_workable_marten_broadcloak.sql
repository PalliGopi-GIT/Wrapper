CREATE EXTENSION IF NOT EXISTS citext;--> statement-breakpoint
CREATE TYPE "public"."asset_status" AS ENUM('pending', 'ready', 'deleted');--> statement-breakpoint
CREATE TYPE "public"."share_access" AS ENUM('signed_in', 'invite_only');--> statement-breakpoint
CREATE TYPE "public"."user_kind" AS ENUM('creator', 'viewer');--> statement-breakpoint
CREATE TABLE "ai_usage" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "ai_usage_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"user_id" text NOT NULL,
	"deck_id" uuid,
	"operation" text NOT NULL,
	"model" text NOT NULL,
	"input_tokens" integer,
	"output_tokens" integer,
	"ok" boolean NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "assets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_id" text NOT NULL,
	"deck_id" uuid,
	"object_key" text NOT NULL,
	"content_type" text NOT NULL,
	"byte_size" bigint NOT NULL,
	"width" integer,
	"height" integer,
	"status" "asset_status" DEFAULT 'pending' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "assets_object_key_unique" UNIQUE("object_key")
);
--> statement-breakpoint
CREATE TABLE "deck_versions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"deck_id" uuid NOT NULL,
	"version" integer NOT NULL,
	"label" text,
	"snapshot" jsonb NOT NULL,
	"created_by" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "decks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_id" text NOT NULL,
	"title" text DEFAULT 'Untitled deck' NOT NULL,
	"subtitle" text DEFAULT '' NOT NULL,
	"theme" text DEFAULT 'obsidian' NOT NULL,
	"archetype" text DEFAULT 'pitch' NOT NULL,
	"settings" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"slides" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"slide_count" integer GENERATED ALWAYS AS (jsonb_array_length(slides)) STORED,
	"revision" integer DEFAULT 1 NOT NULL,
	"thumbnail_key" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "share_access_grants" (
	"share_id" uuid NOT NULL,
	"user_id" text NOT NULL,
	"first_viewed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_viewed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"view_count" integer DEFAULT 1 NOT NULL,
	CONSTRAINT "share_access_grants_share_id_user_id_pk" PRIMARY KEY("share_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "share_invites" (
	"share_id" uuid NOT NULL,
	"email" "citext" NOT NULL,
	"invited_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "share_invites_share_id_email_pk" PRIMARY KEY("share_id","email")
);
--> statement-breakpoint
CREATE TABLE "share_links" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"deck_id" uuid NOT NULL,
	"token" text NOT NULL,
	"created_by" text NOT NULL,
	"name" text,
	"access" "share_access" DEFAULT 'signed_in' NOT NULL,
	"allowed_domains" "citext"[] DEFAULT '{}'::citext[] NOT NULL,
	"version_id" uuid,
	"allow_download" boolean DEFAULT false NOT NULL,
	"show_notes" boolean DEFAULT false NOT NULL,
	"expires_at" timestamp with time zone,
	"revoked_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "share_links_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "share_view_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"share_id" uuid NOT NULL,
	"user_id" text NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_ping_at" timestamp with time zone DEFAULT now() NOT NULL,
	"slide_ms" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"max_slide" integer DEFAULT 0 NOT NULL,
	"user_agent" text,
	"country" text
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" text PRIMARY KEY NOT NULL,
	"email" "citext" NOT NULL,
	"name" text,
	"image_url" text,
	"kind" "user_kind" DEFAULT 'viewer' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "webhook_events" (
	"id" text PRIMARY KEY NOT NULL,
	"type" text NOT NULL,
	"received_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "ai_usage" ADD CONSTRAINT "ai_usage_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_usage" ADD CONSTRAINT "ai_usage_deck_id_decks_id_fk" FOREIGN KEY ("deck_id") REFERENCES "public"."decks"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assets" ADD CONSTRAINT "assets_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assets" ADD CONSTRAINT "assets_deck_id_decks_id_fk" FOREIGN KEY ("deck_id") REFERENCES "public"."decks"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deck_versions" ADD CONSTRAINT "deck_versions_deck_id_decks_id_fk" FOREIGN KEY ("deck_id") REFERENCES "public"."decks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deck_versions" ADD CONSTRAINT "deck_versions_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "decks" ADD CONSTRAINT "decks_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "share_access_grants" ADD CONSTRAINT "share_access_grants_share_id_share_links_id_fk" FOREIGN KEY ("share_id") REFERENCES "public"."share_links"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "share_access_grants" ADD CONSTRAINT "share_access_grants_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "share_invites" ADD CONSTRAINT "share_invites_share_id_share_links_id_fk" FOREIGN KEY ("share_id") REFERENCES "public"."share_links"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "share_links" ADD CONSTRAINT "share_links_deck_id_decks_id_fk" FOREIGN KEY ("deck_id") REFERENCES "public"."decks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "share_links" ADD CONSTRAINT "share_links_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "share_links" ADD CONSTRAINT "share_links_version_id_deck_versions_id_fk" FOREIGN KEY ("version_id") REFERENCES "public"."deck_versions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "share_view_sessions" ADD CONSTRAINT "share_view_sessions_share_id_share_links_id_fk" FOREIGN KEY ("share_id") REFERENCES "public"."share_links"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "share_view_sessions" ADD CONSTRAINT "share_view_sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "ai_usage_user_idx" ON "ai_usage" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "assets_deck_idx" ON "assets" USING btree ("deck_id");--> statement-breakpoint
CREATE INDEX "assets_owner_idx" ON "assets" USING btree ("owner_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "deck_versions_deck_version_uq" ON "deck_versions" USING btree ("deck_id","version");--> statement-breakpoint
CREATE INDEX "decks_owner_idx" ON "decks" USING btree ("owner_id","updated_at") WHERE deleted_at is null;--> statement-breakpoint
CREATE INDEX "decks_owner_id_idx" ON "decks" USING btree ("owner_id");--> statement-breakpoint
CREATE INDEX "share_grants_user_idx" ON "share_access_grants" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "share_links_deck_idx" ON "share_links" USING btree ("deck_id");--> statement-breakpoint
CREATE INDEX "share_sessions_share_idx" ON "share_view_sessions" USING btree ("share_id","started_at");--> statement-breakpoint
CREATE UNIQUE INDEX "users_email_uq" ON "users" USING btree ("email") WHERE deleted_at is null;