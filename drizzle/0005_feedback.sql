CREATE TYPE "public"."feedback_type" AS ENUM('fejl', 'oenske', 'mangel', 'andet');--> statement-breakpoint
CREATE TABLE "feedback" (
	"id" serial PRIMARY KEY NOT NULL,
	"type" "feedback_type" NOT NULL,
	"besked" varchar(4000) NOT NULL,
	"email" varchar(255),
	"side" varchar(500),
	"brugeragent" varchar(500),
	"behandlet" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
