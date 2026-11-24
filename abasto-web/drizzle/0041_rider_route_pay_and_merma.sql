ALTER TABLE "rider_allocations" DROP CONSTRAINT "rider_allocations_settlement_range";--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "route_pay_cents" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "rider_allocations" ADD COLUMN "scrap_quantity" integer;--> statement-breakpoint
ALTER TABLE "rider_assignment_lines" ADD COLUMN "route_pay_cents" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
-- Allocations settled before merma existed had none.
UPDATE "rider_allocations" SET "scrap_quantity" = 0 WHERE "sold_quantity" IS NOT NULL;--> statement-breakpoint
-- Lines created before this migration take the product's current route pay (0 until the owner sets it).
UPDATE "rider_assignment_lines" l SET "route_pay_cents" = p."route_pay_cents" FROM "products" p WHERE p."id" = l."product_id";--> statement-breakpoint
ALTER TABLE "products" ADD CONSTRAINT "products_route_pay_min" CHECK ("products"."route_pay_cents" >= 0);--> statement-breakpoint
ALTER TABLE "rider_allocations" ADD CONSTRAINT "rider_allocations_settlement_range" CHECK (("rider_allocations"."leftover_quantity" is null and "rider_allocations"."sold_quantity" is null and "rider_allocations"."scrap_quantity" is null) or ("rider_allocations"."leftover_quantity" >= 0 and "rider_allocations"."sold_quantity" >= 0 and "rider_allocations"."scrap_quantity" >= 0 and "rider_allocations"."leftover_quantity" + "rider_allocations"."sold_quantity" + "rider_allocations"."scrap_quantity" = "rider_allocations"."quantity"));--> statement-breakpoint
ALTER TABLE "rider_assignment_lines" ADD CONSTRAINT "rider_lines_route_pay_min" CHECK ("rider_assignment_lines"."route_pay_cents" >= 0);
