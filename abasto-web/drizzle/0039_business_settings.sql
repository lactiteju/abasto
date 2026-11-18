CREATE TABLE "business_settings" (
	"id" integer PRIMARY KEY DEFAULT 1 NOT NULL,
	"name" text NOT NULL,
	"location" text NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "business_settings_single_row" CHECK ("business_settings"."id" = 1)
);
--> statement-breakpoint
INSERT INTO "business_settings" ("id", "name", "location") VALUES (1, 'Distribuidora de Lácteos', 'Tejupilco, Estado de México');
