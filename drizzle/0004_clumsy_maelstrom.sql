CREATE TYPE "public"."bundle_status" AS ENUM('draft', 'active', 'archived');--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "bundle_components" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"bundle_id" uuid NOT NULL,
	"variant_id" uuid NOT NULL,
	"quantity" integer NOT NULL,
	"cost_snapshot_cents" bigint,
	"price_snapshot_cents" bigint NOT NULL,
	"shipping_snapshot_cents" bigint DEFAULT 0,
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "bundle_components_uq" UNIQUE("bundle_id","variant_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "product_bundles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"vendor_id" uuid,
	"title" text NOT NULL,
	"handle" text NOT NULL,
	"sku" text NOT NULL,
	"description" text,
	"featured_image_url" text,
	"status" "bundle_status" DEFAULT 'draft' NOT NULL,
	"bundle_price_cents" bigint NOT NULL,
	"inventory_quantity" integer DEFAULT 0 NOT NULL,
	"package_weight_grams" integer,
	"package_dimensions_cm" jsonb,
	"shopify_product_id" text,
	"shopify_variant_id" text,
	"shopify_inventory_item_id" text,
	"shopify_handle" text,
	"display_vendor_name" text,
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "product_bundles_handle_unique" UNIQUE("handle"),
	CONSTRAINT "product_bundles_sku_unique" UNIQUE("sku"),
	CONSTRAINT "bundles_sku_uq" UNIQUE("sku")
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "bundle_components" ADD CONSTRAINT "bundle_components_bundle_id_product_bundles_id_fk" FOREIGN KEY ("bundle_id") REFERENCES "public"."product_bundles"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "bundle_components" ADD CONSTRAINT "bundle_components_variant_id_product_variants_id_fk" FOREIGN KEY ("variant_id") REFERENCES "public"."product_variants"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "product_bundles" ADD CONSTRAINT "product_bundles_vendor_id_vendors_id_fk" FOREIGN KEY ("vendor_id") REFERENCES "public"."vendors"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "bundle_components_bundle_idx" ON "bundle_components" USING btree ("bundle_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "bundle_components_variant_idx" ON "bundle_components" USING btree ("variant_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "bundles_vendor_status_idx" ON "product_bundles" USING btree ("vendor_id","status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "bundles_handle_idx" ON "product_bundles" USING btree ("handle");