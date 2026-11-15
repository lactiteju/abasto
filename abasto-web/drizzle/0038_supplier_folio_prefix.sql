ALTER TABLE "suppliers" ADD COLUMN "folio_prefix" text;--> statement-breakpoint
-- Backfill one unique key per supplier, oldest first, with the same rule the
-- app uses for new suppliers: the initial; else the first two letters; else
-- the initial plus the next consonants, the next letters, then A-Z; else
-- first two letters plus A-Z. Accents are stripped; a name without letters starts from "S".
DO $$
DECLARE
  supplier record;
  letters text;
  first_letter text;
  rest text;
  candidate text;
  candidates text[];
  picked text;
  ch text;
  ch2 text;
BEGIN
  FOR supplier IN SELECT "id", "name" FROM "suppliers" ORDER BY "created_at", "id" LOOP
    letters := regexp_replace(
      translate(upper(supplier."name"), 'ÁÀÄÂÉÈËÊÍÌÏÎÓÒÖÔÚÙÜÛÑ', 'AAAAEEEEIIIIOOOOUUUUN'),
      '[^A-Z]', '', 'g');
    IF letters = '' THEN letters := 'S'; END IF;
    first_letter := substr(letters, 1, 1);
    rest := substr(letters, 2);
    candidates := ARRAY[first_letter];
    IF rest <> '' THEN candidates := candidates || (first_letter || substr(rest, 1, 1)); END IF;
    FOREACH ch IN ARRAY regexp_split_to_array(regexp_replace(rest, '[AEIOU]', '', 'g'), '') LOOP
      IF ch <> '' THEN candidates := candidates || (first_letter || ch); END IF;
    END LOOP;
    FOREACH ch IN ARRAY regexp_split_to_array(rest, '') LOOP
      IF ch <> '' THEN candidates := candidates || (first_letter || ch); END IF;
    END LOOP;
    FOREACH ch IN ARRAY regexp_split_to_array('ABCDEFGHIJKLMNOPQRSTUVWXYZ', '') LOOP
      candidates := candidates || (first_letter || ch);
    END LOOP;
    picked := NULL;
    FOREACH candidate IN ARRAY candidates LOOP
      IF NOT EXISTS (SELECT 1 FROM "suppliers" WHERE "folio_prefix" = candidate) THEN
        picked := candidate;
        EXIT;
      END IF;
    END LOOP;
    IF picked IS NULL THEN
      FOREACH ch IN ARRAY regexp_split_to_array('ABCDEFGHIJKLMNOPQRSTUVWXYZ', '') LOOP
        FOREACH ch2 IN ARRAY regexp_split_to_array('ABCDEFGHIJKLMNOPQRSTUVWXYZ', '') LOOP
          candidate := first_letter || ch || ch2;
          IF NOT EXISTS (SELECT 1 FROM "suppliers" WHERE "folio_prefix" = candidate) THEN
            picked := candidate;
            EXIT;
          END IF;
        END LOOP;
        EXIT WHEN picked IS NOT NULL;
      END LOOP;
    END IF;
    UPDATE "suppliers" SET "folio_prefix" = picked WHERE "id" = supplier."id";
  END LOOP;
END $$;--> statement-breakpoint
ALTER TABLE "suppliers" ALTER COLUMN "folio_prefix" SET NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "suppliers_folio_prefix_unique" ON "suppliers" USING btree ("folio_prefix");--> statement-breakpoint
ALTER TABLE "suppliers" ADD CONSTRAINT "suppliers_folio_prefix_check" CHECK ("suppliers"."folio_prefix" ~ '^[A-Z]{1,3}$');--> statement-breakpoint
-- "Grupo Lala" is just "LALA" everywhere. Its key comes out as "G" above; the
-- client's example is L00001, so move it to "L" when that is free.
UPDATE "suppliers" SET "name" = 'LALA' WHERE lower("name") = 'grupo lala'
  AND NOT EXISTS (SELECT 1 FROM "suppliers" WHERE lower("name") = 'lala');--> statement-breakpoint
UPDATE "suppliers" SET "folio_prefix" = 'L' WHERE "name" = 'LALA'
  AND NOT EXISTS (SELECT 1 FROM "suppliers" WHERE "folio_prefix" = 'L');--> statement-breakpoint
-- Automatic E-folios become the supplier key plus five digits, numbered per
-- supplier in creation order. Lots already created keep their codes.
UPDATE "purchases" SET "reference" = numbered."folio_text"
FROM (
  SELECT p."id", s."folio_prefix" || lpad(
    (row_number() OVER (PARTITION BY p."supplier_id" ORDER BY p."folio"))::text, 5, '0'
  ) AS "folio_text"
  FROM "purchases" p
  JOIN "suppliers" s ON s."id" = p."supplier_id"
  WHERE p."reference" ~ '^E[0-9]+$'
) AS numbered
WHERE "purchases"."id" = numbered."id";
