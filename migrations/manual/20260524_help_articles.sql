-- Inflow Help page: helpArticles table.
-- See INFLOW_HELP_PLAN.md §2.1 for design rationale.
-- Apply via DO App Platform Console against prod Neon DB.
-- Do NOT run drizzle-kit push from local — local DATABASE_URL is the dev branch.

CREATE TABLE "help_articles" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"title" text NOT NULL,
	"category" text NOT NULL,
	"body_html" text NOT NULL,
	"sequence_order" integer DEFAULT 0,
	"related_video_ids" text[],
	"published" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "help_articles_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE INDEX "help_articles_category_idx" ON "help_articles" USING btree ("category");--> statement-breakpoint
CREATE INDEX "help_articles_published_idx" ON "help_articles" USING btree ("published");
