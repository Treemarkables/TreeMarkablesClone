// One-off migration: create the `photo_annotations` table + index.
// We bypass drizzle-kit push because there is pre-existing migration debt
// (help_articles + others) sitting in front of this change, and drizzle-kit's
// interactive prompts make running just this one new table awkward. The DDL
// below mirrors exactly what shared/schema.ts declares for photo_annotations.
import { db } from '../server/db.ts';
import { sql } from 'drizzle-orm';

await db.execute(sql`
  CREATE TABLE IF NOT EXISTS photo_annotations (
    id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
    source_url text NOT NULL UNIQUE,
    annotations jsonb NOT NULL,
    annotated_url text,
    annotated_by text,
    created_at timestamp DEFAULT now(),
    updated_at timestamp DEFAULT now()
  )
`);

await db.execute(sql`
  CREATE INDEX IF NOT EXISTS photo_annotations_source_url_idx
    ON photo_annotations (source_url)
`);

const r = await db.execute(
  sql`SELECT COUNT(*)::int AS n FROM photo_annotations`,
);
console.log('✅ photo_annotations table ready, row count:', r.rows[0].n);
process.exit(0);
