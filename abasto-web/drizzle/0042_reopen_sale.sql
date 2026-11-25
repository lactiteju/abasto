DROP INDEX "cash_movements_one_sale_per_order";--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "reopen_count" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "reopened_at" timestamp;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "reopened_by" text;--> statement-breakpoint
ALTER TABLE "cash_movements" ADD COLUMN "sale_cycle" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_reopened_by_user_id_fk" FOREIGN KEY ("reopened_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "cash_movements_one_sale_per_order_cycle" ON "cash_movements" USING btree ("order_id","sale_cycle") WHERE "cash_movements"."type" = 'sale';