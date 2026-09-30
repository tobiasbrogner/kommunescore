CREATE TYPE "public"."skala" AS ENUM('lineaer', 'logaritmisk');--> statement-breakpoint
ALTER TABLE "noegletal" ADD COLUMN "skala" "skala" DEFAULT 'lineaer' NOT NULL;--> statement-breakpoint
ALTER TABLE "noegletal" ADD COLUMN "standard_valgt" boolean DEFAULT true NOT NULL;