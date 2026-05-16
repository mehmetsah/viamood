CREATE TYPE "public"."mikro_sync_status" AS ENUM('pending', 'customer_created', 'order_added', 'approved', 'failed', 'skipped');--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "mikro_sequences" (
	"key" text PRIMARY KEY NOT NULL,
	"value" integer NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "mikro_sync_status" "mikro_sync_status" DEFAULT 'pending' NOT NULL;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "mikro_cari_kodu" text;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "mikro_evrak_seri" text;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "mikro_evrak_sira" integer DEFAULT 1;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "mikro_error" text;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "mikro_synced_at" timestamp with time zone;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "orders_mikro_status_idx" ON "orders" USING btree ("mikro_sync_status");