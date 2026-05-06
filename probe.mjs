import { neon } from '@neondatabase/serverless';
const sql = neon(process.env.DATABASE_URL);
const names = ['Mark Thomas','Beetham','Hayley','Janis','Cynthia','Tamarau','Mike Leahy','Sue Ngarimu','Gary Lodge','Ilminster','Gisborne'];
for (const n of names) {
  const rows = await sql`
    SELECT j.job_number, j.status, j.scheduled_date, j.subtotal, j.total_amount, j.total_including_gst, j.estimated_man_hours, c.name AS customer, j.title
    FROM jobs j LEFT JOIN customers c ON c.id = j.customer_id
    WHERE c.name ILIKE ${'%'+n+'%'} OR j.title ILIKE ${'%'+n+'%'}
    ORDER BY j.scheduled_date DESC NULLS LAST LIMIT 6`;
  console.log(`\n--- "${n}" (${rows.length}) ---`);
  for (const r of rows) {
    console.log(`#${r.job_number} ${(r.scheduled_date||'').toString().slice(0,16)} ${r.status} sub=${r.subtotal} tot=${r.total_amount} incGst=${r.total_including_gst} hrs=${r.estimated_man_hours} ${r.customer}/${r.title||''}`);
  }
}
