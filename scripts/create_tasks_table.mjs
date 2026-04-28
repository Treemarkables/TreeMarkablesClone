// One-off migration: create the `tasks` table + indexes.
// We bypass drizzle-kit push because its interactive prompt about an
// unrelated unique constraint on notification_preferences can't be answered
// from a piped stdin. The DDL below mirrors exactly what shared/schema.ts
// declares for the tasks table.
import { db } from '../server/db.ts';
import { sql } from 'drizzle-orm';

await db.execute(sql`
  CREATE TABLE IF NOT EXISTS tasks (
    id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
    title text NOT NULL,
    description text,
    category text,
    priority text DEFAULT 'normal',
    status text NOT NULL DEFAULT 'todo',
    blocked_reason text,
    assignee_id varchar REFERENCES employees(id) ON DELETE SET NULL,
    created_by varchar REFERENCES employees(id) ON DELETE SET NULL,
    due_date timestamp,
    linked_job_id varchar REFERENCES jobs(id) ON DELETE SET NULL,
    linked_equipment_id varchar REFERENCES equipment(id) ON DELETE SET NULL,
    recurring boolean DEFAULT false,
    recurring_interval_days integer,
    parent_task_id varchar,
    completed_at timestamp,
    deleted_at timestamp,
    created_at timestamp DEFAULT now(),
    updated_at timestamp DEFAULT now()
  )
`);

await db.execute(sql`CREATE INDEX IF NOT EXISTS tasks_status_idx ON tasks (status)`);
await db.execute(sql`CREATE INDEX IF NOT EXISTS tasks_assignee_idx ON tasks (assignee_id)`);
await db.execute(sql`CREATE INDEX IF NOT EXISTS tasks_due_date_idx ON tasks (due_date)`);
await db.execute(sql`CREATE INDEX IF NOT EXISTS tasks_linked_job_idx ON tasks (linked_job_id)`);

const r = await db.execute(sql`SELECT COUNT(*)::int AS n FROM tasks`);
console.log('✅ tasks table ready, row count:', r.rows[0].n);
process.exit(0);
