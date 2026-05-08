CREATE TABLE IF NOT EXISTS "shopify_connections" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"shop_domain" text NOT NULL,
	"access_token" text NOT NULL,
	"scope" text NOT NULL,
	"shop_id" text,
	"shop_name" text,
	"shop_email" text,
	"country_code" text,
	"currency" text,
	"primary_location_id" text,
	"installed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"uninstalled_at" timestamp with time zone,
	"last_synced_at" timestamp with time zone,
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "shopify_connections_shop_domain_unique" UNIQUE("shop_domain")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "shopify_oauth_states" (
	"state" text PRIMARY KEY NOT NULL,
	"shop_domain" text NOT NULL,
	"initiated_by_user_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "shopify_connections_domain_idx" ON "shopify_connections" USING btree ("shop_domain");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "shopify_connections_active_idx" ON "shopify_connections" USING btree ("uninstalled_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "shopify_oauth_states_expires_idx" ON "shopify_oauth_states" USING btree ("expires_at");