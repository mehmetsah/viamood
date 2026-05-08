CREATE TYPE "public"."user_role" AS ENUM('customer', 'vendor', 'vendor_admin', 'admin', 'super_admin');--> statement-breakpoint
CREATE TYPE "public"."kyc_document_type" AS ENUM('tax_certificate', 'signature_circular', 'trade_registry', 'identity_card', 'iban_certificate', 'contract_signed', 'other');--> statement-breakpoint
CREATE TYPE "public"."kyc_status" AS ENUM('pending', 'approved', 'rejected', 'expired');--> statement-breakpoint
CREATE TYPE "public"."membership_role" AS ENUM('owner', 'manager', 'staff', 'viewer');--> statement-breakpoint
CREATE TYPE "public"."payment_mode" AS ENUM('marketplace_split', 'cari');--> statement-breakpoint
CREATE TYPE "public"."vendor_status" AS ENUM('pending', 'active', 'suspended', 'rejected', 'archived');--> statement-breakpoint
CREATE TYPE "public"."product_status" AS ENUM('draft', 'active', 'archived');--> statement-breakpoint
CREATE TYPE "public"."order_financial_status" AS ENUM('pending', 'authorized', 'paid', 'partially_paid', 'refunded', 'partially_refunded', 'voided');--> statement-breakpoint
CREATE TYPE "public"."order_fulfillment_status" AS ENUM('unfulfilled', 'partial', 'fulfilled', 'restocked');--> statement-breakpoint
CREATE TYPE "public"."order_line_item_status" AS ENUM('pending', 'awaiting_pickup', 'shipped', 'delivered', 'cancelled', 'refunded');--> statement-breakpoint
CREATE TYPE "public"."fulfillment_mode" AS ENUM('split', 'consolidate_self', 'consolidate_carrier');--> statement-breakpoint
CREATE TYPE "public"."fulfillment_status" AS ENUM('pending', 'label_created', 'picked_up', 'in_transit', 'out_for_delivery', 'delivered', 'failed', 'returned', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."ledger_entry_status" AS ENUM('accrued', 'on_hold', 'paid', 'reversed');--> statement-breakpoint
CREATE TYPE "public"."ledger_entry_type" AS ENUM('sale', 'refund', 'commission', 'fee', 'adjustment', 'payout');--> statement-breakpoint
CREATE TYPE "public"."payout_method" AS ENUM('iyzico_split', 'iyzico_transfer', 'manual_bank', 'paytr_bk');--> statement-breakpoint
CREATE TYPE "public"."payout_status" AS ENUM('draft', 'approved', 'processing', 'paid', 'failed', 'cancelled');--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "accounts" (
	"user_id" uuid NOT NULL,
	"type" text NOT NULL,
	"provider" text NOT NULL,
	"provider_account_id" text NOT NULL,
	"refresh_token" text,
	"access_token" text,
	"expires_at" integer,
	"token_type" text,
	"scope" text,
	"id_token" text,
	"session_state" text,
	CONSTRAINT "accounts_provider_provider_account_id_pk" PRIMARY KEY("provider","provider_account_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "authenticators" (
	"credential_id" text NOT NULL,
	"user_id" uuid NOT NULL,
	"provider_account_id" text NOT NULL,
	"credential_public_key" text NOT NULL,
	"counter" integer NOT NULL,
	"credential_device_type" text NOT NULL,
	"credential_backed_up" boolean NOT NULL,
	"transports" text,
	CONSTRAINT "authenticators_user_id_credential_id_pk" PRIMARY KEY("user_id","credential_id"),
	CONSTRAINT "authenticators_credential_id_unique" UNIQUE("credential_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "sessions" (
	"session_token" text PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"expires" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text,
	"email" text NOT NULL,
	"email_verified" timestamp with time zone,
	"image" text,
	"password_hash" text,
	"role" "user_role" DEFAULT 'customer' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "verification_tokens" (
	"identifier" text NOT NULL,
	"token" text NOT NULL,
	"expires" timestamp with time zone NOT NULL,
	CONSTRAINT "verification_tokens_identifier_token_pk" PRIMARY KEY("identifier","token")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "vendor_kyc_documents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"vendor_id" uuid NOT NULL,
	"doc_type" "kyc_document_type" NOT NULL,
	"storage_path" text NOT NULL,
	"file_name" text NOT NULL,
	"file_size_bytes" integer,
	"mime_type" text,
	"status" "kyc_status" DEFAULT 'pending' NOT NULL,
	"reviewed_by_user_id" uuid,
	"reviewed_at" timestamp with time zone,
	"rejection_reason" text,
	"expires_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "kyc_vendor_doc_active_uq" UNIQUE("vendor_id","doc_type")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "vendor_memberships" (
	"user_id" uuid NOT NULL,
	"vendor_id" uuid NOT NULL,
	"role" "membership_role" DEFAULT 'staff' NOT NULL,
	"invited_at" timestamp with time zone,
	"accepted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "vendor_memberships_user_id_vendor_id_pk" PRIMARY KEY("user_id","vendor_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "vendors" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"legal_name" text,
	"description" text,
	"logo_url" text,
	"email" text NOT NULL,
	"phone" text,
	"website" text,
	"tax_id" text,
	"tax_office" text,
	"mersis_no" text,
	"address_line1" text,
	"address_line2" text,
	"city" text,
	"district" text,
	"postal_code" text,
	"country" text DEFAULT 'TR',
	"bank_name" text,
	"bank_branch" text,
	"iban" text,
	"account_holder_name" text,
	"status" "vendor_status" DEFAULT 'pending' NOT NULL,
	"suspended_reason" text,
	"commission_rate" integer DEFAULT 0 NOT NULL,
	"payment_mode" "payment_mode" DEFAULT 'cari' NOT NULL,
	"payment_terms_days" integer DEFAULT 30,
	"iyzico_submerchant_key" text,
	"product_count" integer DEFAULT 0 NOT NULL,
	"active_order_count" integer DEFAULT 0 NOT NULL,
	"total_revenue_cents" bigint DEFAULT 0 NOT NULL,
	"total_payout_cents" bigint DEFAULT 0 NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "vendors_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "product_variants" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"product_id" uuid NOT NULL,
	"vendor_id" uuid NOT NULL,
	"shopify_variant_id" text NOT NULL,
	"shopify_inventory_item_id" text,
	"title" text,
	"sku" text,
	"barcode" text,
	"price_cents" bigint NOT NULL,
	"compare_at_price_cents" bigint,
	"cost_cents" bigint,
	"weight_grams" integer,
	"requires_shipping" boolean DEFAULT true NOT NULL,
	"is_taxable" boolean DEFAULT true NOT NULL,
	"option1" text,
	"option2" text,
	"option3" text,
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "product_variants_shopify_variant_id_unique" UNIQUE("shopify_variant_id"),
	CONSTRAINT "variants_shopify_uq" UNIQUE("shopify_variant_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "products" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"vendor_id" uuid NOT NULL,
	"shopify_product_id" text NOT NULL,
	"shopify_handle" text NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"product_type" text,
	"tags" jsonb DEFAULT '[]'::jsonb,
	"status" "product_status" DEFAULT 'draft' NOT NULL,
	"vendor_slug" text NOT NULL,
	"vendor_name" text NOT NULL,
	"min_price_cents" bigint,
	"max_price_cents" bigint,
	"total_inventory" integer DEFAULT 0,
	"featured_image_url" text,
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "products_shopify_product_id_unique" UNIQUE("shopify_product_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "inventory_levels" (
	"vendor_id" uuid NOT NULL,
	"variant_id" uuid NOT NULL,
	"quantity" integer DEFAULT 0 NOT NULL,
	"reserved" integer DEFAULT 0 NOT NULL,
	"available" integer DEFAULT 0 NOT NULL,
	"shopify_location_id" text,
	"shopify_inventory_level_id" text,
	"last_synced_at" text,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "inventory_levels_vendor_id_variant_id_pk" PRIMARY KEY("vendor_id","variant_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "order_line_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_id" uuid NOT NULL,
	"vendor_id" uuid NOT NULL,
	"product_id" uuid,
	"variant_id" uuid,
	"shopify_line_item_id" text NOT NULL,
	"title" text NOT NULL,
	"variant_title" text,
	"sku" text,
	"quantity" integer NOT NULL,
	"unit_price_cents" bigint NOT NULL,
	"total_price_cents" bigint NOT NULL,
	"discount_cents" bigint DEFAULT 0 NOT NULL,
	"status" "order_line_item_status" DEFAULT 'pending' NOT NULL,
	"fulfillment_mode" text,
	"assigned_at" timestamp with time zone,
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "orders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"shopify_order_id" text NOT NULL,
	"shopify_order_name" text NOT NULL,
	"customer_id" text,
	"customer_email" text,
	"customer_name" text,
	"customer_phone" text,
	"shipping_address" jsonb,
	"subtotal_cents" bigint NOT NULL,
	"shipping_cents" bigint DEFAULT 0 NOT NULL,
	"tax_cents" bigint DEFAULT 0 NOT NULL,
	"discount_cents" bigint DEFAULT 0 NOT NULL,
	"total_cents" bigint NOT NULL,
	"currency" text DEFAULT 'TRY' NOT NULL,
	"financial_status" "order_financial_status" DEFAULT 'pending' NOT NULL,
	"fulfillment_status" "order_fulfillment_status" DEFAULT 'unfulfilled' NOT NULL,
	"cancelled_at" timestamp with time zone,
	"cancel_reason" text,
	"vendor_count" integer DEFAULT 0 NOT NULL,
	"vendor_ids" jsonb DEFAULT '[]'::jsonb,
	"source_name" text,
	"note" text,
	"tags" jsonb DEFAULT '[]'::jsonb,
	"placed_at" timestamp with time zone NOT NULL,
	"raw_shopify_payload" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "orders_shopify_order_id_unique" UNIQUE("shopify_order_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "order_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_id" uuid NOT NULL,
	"event_type" text NOT NULL,
	"payload" jsonb DEFAULT '{}'::jsonb,
	"actor_type" text,
	"actor_id" text,
	"occurred_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "routing_decisions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_id" uuid NOT NULL,
	"matched_rule_id" uuid,
	"mode" "fulfillment_mode" NOT NULL,
	"assignments" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "routing_decisions_order_id_unique" UNIQUE("order_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "routing_rules" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"priority" integer NOT NULL,
	"conditions" jsonb NOT NULL,
	"action" "fulfillment_mode" NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"times_matched" bigint DEFAULT 0 NOT NULL,
	"last_matched_at" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "fulfillment_line_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"fulfillment_id" uuid NOT NULL,
	"line_item_id" uuid NOT NULL,
	"quantity" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "fulfillments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_id" uuid NOT NULL,
	"vendor_id" uuid NOT NULL,
	"shopify_fulfillment_order_id" text,
	"shopify_fulfillment_id" text,
	"kargolab_shipment_id" text,
	"carrier" text,
	"tracking_number" text,
	"tracking_url" text,
	"label_url" text,
	"status" "fulfillment_status" DEFAULT 'pending' NOT NULL,
	"ship_from_address" jsonb,
	"ship_to_address" jsonb,
	"package_weight_grams" integer,
	"package_dimensions_cm" jsonb,
	"label_created_at" timestamp with time zone,
	"picked_up_at" timestamp with time zone,
	"delivered_at" timestamp with time zone,
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "tracking_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"fulfillment_id" uuid NOT NULL,
	"status" text NOT NULL,
	"location" text,
	"description" text,
	"occurred_at" timestamp with time zone NOT NULL,
	"raw_payload" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "commission_ledger" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"vendor_id" uuid NOT NULL,
	"order_id" uuid NOT NULL,
	"order_line_item_id" uuid,
	"type" "ledger_entry_type" NOT NULL,
	"status" "ledger_entry_status" DEFAULT 'accrued' NOT NULL,
	"gross_amount_cents" bigint NOT NULL,
	"commission_rate_bps" integer NOT NULL,
	"commission_amount_cents" bigint NOT NULL,
	"payout_amount_cents" bigint NOT NULL,
	"currency" text DEFAULT 'TRY' NOT NULL,
	"payout_batch_id" uuid,
	"reversed_by_id" uuid,
	"reversed_at" timestamp with time zone,
	"note" text,
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "payouts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"vendor_id" uuid NOT NULL,
	"method" "payout_method" NOT NULL,
	"status" "payout_status" DEFAULT 'draft' NOT NULL,
	"period_start" timestamp with time zone NOT NULL,
	"period_end" timestamp with time zone NOT NULL,
	"gross_amount_cents" bigint NOT NULL,
	"commission_amount_cents" bigint DEFAULT 0 NOT NULL,
	"fee_amount_cents" bigint DEFAULT 0 NOT NULL,
	"net_amount_cents" bigint NOT NULL,
	"currency" text DEFAULT 'TRY' NOT NULL,
	"bank_iban" text,
	"bank_account_holder" text,
	"approved_by_user_id" uuid,
	"approved_at" timestamp with time zone,
	"paid_at" timestamp with time zone,
	"failure_reason" text,
	"external_reference" text,
	"note" text,
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "audit_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"actor_type" text NOT NULL,
	"actor_id" text,
	"actor_ip_address" text,
	"actor_user_agent" text,
	"action" text NOT NULL,
	"entity_type" text NOT NULL,
	"entity_id" text,
	"before" jsonb,
	"after" jsonb,
	"request_id" text,
	"note" text,
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"occurred_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "idempotency_keys" (
	"key" text PRIMARY KEY NOT NULL,
	"scope" text NOT NULL,
	"request_hash" text,
	"response_status" text,
	"response_body" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "accounts" ADD CONSTRAINT "accounts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "authenticators" ADD CONSTRAINT "authenticators_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "vendor_kyc_documents" ADD CONSTRAINT "vendor_kyc_documents_vendor_id_vendors_id_fk" FOREIGN KEY ("vendor_id") REFERENCES "public"."vendors"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "vendor_kyc_documents" ADD CONSTRAINT "vendor_kyc_documents_reviewed_by_user_id_users_id_fk" FOREIGN KEY ("reviewed_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "vendor_memberships" ADD CONSTRAINT "vendor_memberships_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "vendor_memberships" ADD CONSTRAINT "vendor_memberships_vendor_id_vendors_id_fk" FOREIGN KEY ("vendor_id") REFERENCES "public"."vendors"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "product_variants" ADD CONSTRAINT "product_variants_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "product_variants" ADD CONSTRAINT "product_variants_vendor_id_vendors_id_fk" FOREIGN KEY ("vendor_id") REFERENCES "public"."vendors"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "products" ADD CONSTRAINT "products_vendor_id_vendors_id_fk" FOREIGN KEY ("vendor_id") REFERENCES "public"."vendors"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "inventory_levels" ADD CONSTRAINT "inventory_levels_vendor_id_vendors_id_fk" FOREIGN KEY ("vendor_id") REFERENCES "public"."vendors"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "inventory_levels" ADD CONSTRAINT "inventory_levels_variant_id_product_variants_id_fk" FOREIGN KEY ("variant_id") REFERENCES "public"."product_variants"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "order_line_items" ADD CONSTRAINT "order_line_items_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "order_line_items" ADD CONSTRAINT "order_line_items_vendor_id_vendors_id_fk" FOREIGN KEY ("vendor_id") REFERENCES "public"."vendors"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "order_line_items" ADD CONSTRAINT "order_line_items_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "order_line_items" ADD CONSTRAINT "order_line_items_variant_id_product_variants_id_fk" FOREIGN KEY ("variant_id") REFERENCES "public"."product_variants"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "order_events" ADD CONSTRAINT "order_events_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "routing_decisions" ADD CONSTRAINT "routing_decisions_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "routing_decisions" ADD CONSTRAINT "routing_decisions_matched_rule_id_routing_rules_id_fk" FOREIGN KEY ("matched_rule_id") REFERENCES "public"."routing_rules"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "fulfillment_line_items" ADD CONSTRAINT "fulfillment_line_items_fulfillment_id_fulfillments_id_fk" FOREIGN KEY ("fulfillment_id") REFERENCES "public"."fulfillments"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "fulfillment_line_items" ADD CONSTRAINT "fulfillment_line_items_line_item_id_order_line_items_id_fk" FOREIGN KEY ("line_item_id") REFERENCES "public"."order_line_items"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "fulfillments" ADD CONSTRAINT "fulfillments_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "fulfillments" ADD CONSTRAINT "fulfillments_vendor_id_vendors_id_fk" FOREIGN KEY ("vendor_id") REFERENCES "public"."vendors"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "tracking_events" ADD CONSTRAINT "tracking_events_fulfillment_id_fulfillments_id_fk" FOREIGN KEY ("fulfillment_id") REFERENCES "public"."fulfillments"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "commission_ledger" ADD CONSTRAINT "commission_ledger_vendor_id_vendors_id_fk" FOREIGN KEY ("vendor_id") REFERENCES "public"."vendors"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "commission_ledger" ADD CONSTRAINT "commission_ledger_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "commission_ledger" ADD CONSTRAINT "commission_ledger_order_line_item_id_order_line_items_id_fk" FOREIGN KEY ("order_line_item_id") REFERENCES "public"."order_line_items"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "payouts" ADD CONSTRAINT "payouts_vendor_id_vendors_id_fk" FOREIGN KEY ("vendor_id") REFERENCES "public"."vendors"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "kyc_vendor_idx" ON "vendor_kyc_documents" USING btree ("vendor_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "kyc_status_idx" ON "vendor_kyc_documents" USING btree ("status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "memberships_vendor_idx" ON "vendor_memberships" USING btree ("vendor_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "vendors_status_idx" ON "vendors" USING btree ("status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "vendors_created_at_idx" ON "vendors" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "vendors_email_idx" ON "vendors" USING btree ("email");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "variants_product_idx" ON "product_variants" USING btree ("product_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "variants_vendor_idx" ON "product_variants" USING btree ("vendor_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "variants_sku_idx" ON "product_variants" USING btree ("sku");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "products_vendor_status_idx" ON "products" USING btree ("vendor_id","status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "products_vendor_created_idx" ON "products" USING btree ("vendor_id","created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "products_handle_idx" ON "products" USING btree ("shopify_handle");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "inventory_variant_idx" ON "inventory_levels" USING btree ("variant_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "inventory_updated_idx" ON "inventory_levels" USING btree ("updated_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "line_items_order_idx" ON "order_line_items" USING btree ("order_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "line_items_vendor_status_idx" ON "order_line_items" USING btree ("vendor_id","status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "line_items_vendor_created_idx" ON "order_line_items" USING btree ("vendor_id","created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "orders_placed_at_idx" ON "orders" USING btree ("placed_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "orders_customer_idx" ON "orders" USING btree ("customer_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "orders_financial_status_idx" ON "orders" USING btree ("financial_status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "orders_fulfillment_status_idx" ON "orders" USING btree ("fulfillment_status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "order_events_order_idx" ON "order_events" USING btree ("order_id","occurred_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "order_events_type_idx" ON "order_events" USING btree ("event_type");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "routing_decisions_rule_idx" ON "routing_decisions" USING btree ("matched_rule_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "routing_rules_priority_idx" ON "routing_rules" USING btree ("priority");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "routing_rules_enabled_idx" ON "routing_rules" USING btree ("enabled");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "fli_fulfillment_idx" ON "fulfillment_line_items" USING btree ("fulfillment_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "fli_line_item_idx" ON "fulfillment_line_items" USING btree ("line_item_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "fulfillments_order_idx" ON "fulfillments" USING btree ("order_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "fulfillments_vendor_status_idx" ON "fulfillments" USING btree ("vendor_id","status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "fulfillments_tracking_idx" ON "fulfillments" USING btree ("tracking_number");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "tracking_fulfillment_idx" ON "tracking_events" USING btree ("fulfillment_id","occurred_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ledger_vendor_status_idx" ON "commission_ledger" USING btree ("vendor_id","status","created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ledger_order_idx" ON "commission_ledger" USING btree ("order_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ledger_payout_batch_idx" ON "commission_ledger" USING btree ("payout_batch_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "payouts_vendor_status_idx" ON "payouts" USING btree ("vendor_id","status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "payouts_period_idx" ON "payouts" USING btree ("period_start","period_end");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "audit_actor_idx" ON "audit_log" USING btree ("actor_id","occurred_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "audit_entity_idx" ON "audit_log" USING btree ("entity_type","entity_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "audit_action_idx" ON "audit_log" USING btree ("action","occurred_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "audit_occurred_idx" ON "audit_log" USING btree ("occurred_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idemp_scope_idx" ON "idempotency_keys" USING btree ("scope");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idemp_expires_idx" ON "idempotency_keys" USING btree ("expires_at");