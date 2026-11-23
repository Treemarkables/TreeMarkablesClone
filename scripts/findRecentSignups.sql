-- Read-only checks for a signup that should appear on Settings → Subscribers.
-- Run against the prod Neon branch. No writes.
--
-- Successful /api/signup creates: businesses + business_settings + admin
-- employee + (usually) a freemium subscriptions row. The admin UI lists
-- businesses. If the tester can log in but you cannot find them, use (4)
-- with their email.

-- 1) Recent businesses (this is the Subscribers directory)
SELECT id, name, slug, status, created_at, comped_at
FROM businesses
ORDER BY created_at DESC NULLS LAST
LIMIT 50;

-- 2) Recent admin employees (the email typed at signup)
SELECT e.id,
       e.email,
       e.first_name,
       e.last_name,
       e.business_id,
       e.created_at,
       b.name AS business_name,
       b.slug
FROM employees e
LEFT JOIN businesses b ON b.id = e.business_id
WHERE e.role = 'admin'
ORDER BY e.created_at DESC NULLS LAST
LIMIT 50;

-- 3) Admin employees whose business row is missing
SELECT e.id, e.email, e.business_id, e.created_at
FROM employees e
LEFT JOIN businesses b ON b.id = e.business_id
WHERE e.role = 'admin'
  AND b.id IS NULL;

-- 4) Look up one tester. Replace the email, then run:
-- SELECT e.id, e.email, e.first_name, e.last_name, e.role, e.business_id, e.created_at,
--        b.id AS business_id_found, b.name, b.slug, b.status, b.created_at AS business_created_at
-- FROM employees e
-- LEFT JOIN businesses b ON b.id = e.business_id
-- WHERE lower(e.email) = lower('TESTER@EMAIL');

-- If (4) finds an employee on the Treemarkables business, they signed in as
-- staff of the platform tenant (or the email was already taken) and did not
-- get their own subscriber row. Create a tenant with a free email via
-- scripts/create-tenant.mts or have them use /signup with a different email.
--
-- If (4) finds a business row, they should appear on /admin/subscribers after
-- this fix (search by email). No data patch needed.
