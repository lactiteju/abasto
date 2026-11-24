ALTER TABLE "warehouses" ADD COLUMN "is_default" boolean DEFAULT false NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "warehouses_single_default" ON "warehouses" USING btree ("is_default") WHERE "warehouses"."is_default";
--> statement-breakpoint
UPDATE "warehouses" SET "is_default" = true WHERE lower("name") = 'tejupilco';
