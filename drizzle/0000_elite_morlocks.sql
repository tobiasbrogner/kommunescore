CREATE TYPE "public"."retning" AS ENUM('hoejere_bedre', 'lavere_bedre');--> statement-breakpoint
CREATE TABLE "administratorer" (
	"id" serial PRIMARY KEY NOT NULL,
	"email" varchar(255) NOT NULL,
	"password_hash" varchar(255) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "administratorer_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "kategorier" (
	"id" serial PRIMARY KEY NOT NULL,
	"navn" varchar(100) NOT NULL,
	"slug" varchar(50) NOT NULL,
	"standardvaegt" numeric(5, 2) DEFAULT '1' NOT NULL,
	"sortering" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "kategorier_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "kommune_noegletal" (
	"kommune_kode" varchar(4) NOT NULL,
	"noegletal_id" integer NOT NULL,
	"vaerdi" numeric(14, 4) NOT NULL,
	CONSTRAINT "kommune_noegletal_kommune_kode_noegletal_id_pk" PRIMARY KEY("kommune_kode","noegletal_id")
);
--> statement-breakpoint
CREATE TABLE "kommuner" (
	"kode" varchar(4) PRIMARY KEY NOT NULL,
	"navn" varchar(100) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "noegletal" (
	"id" serial PRIMARY KEY NOT NULL,
	"kategori_id" integer NOT NULL,
	"navn" varchar(150) NOT NULL,
	"enhed" varchar(30) NOT NULL,
	"retning" "retning" NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sessioner" (
	"id" serial PRIMARY KEY NOT NULL,
	"administrator_id" integer NOT NULL,
	"token_hash" varchar(64) NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "sessioner_token_hash_unique" UNIQUE("token_hash")
);
--> statement-breakpoint
ALTER TABLE "kommune_noegletal" ADD CONSTRAINT "kommune_noegletal_kommune_kode_kommuner_kode_fk" FOREIGN KEY ("kommune_kode") REFERENCES "public"."kommuner"("kode") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "kommune_noegletal" ADD CONSTRAINT "kommune_noegletal_noegletal_id_noegletal_id_fk" FOREIGN KEY ("noegletal_id") REFERENCES "public"."noegletal"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "noegletal" ADD CONSTRAINT "noegletal_kategori_id_kategorier_id_fk" FOREIGN KEY ("kategori_id") REFERENCES "public"."kategorier"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessioner" ADD CONSTRAINT "sessioner_administrator_id_administratorer_id_fk" FOREIGN KEY ("administrator_id") REFERENCES "public"."administratorer"("id") ON DELETE cascade ON UPDATE no action;