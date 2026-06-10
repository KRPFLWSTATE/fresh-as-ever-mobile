-- Pass9 QA note: duplicate customer profile (DO NOT RUN DELETE without explicit approval)
-- Project: odkbpeelvcdmlimdflbr
-- Documented: 2026-06-11

-- Canonical QA customer (use for all Pass7–9 verification):
--   id:    571aadc0-d2e6-43bf-bab7-03a35ce3ef7f
--   email: qa.customer@freshasever.test
--   orders: 8 total (2 impact-eligible collected/resolved, 5 cancelled, 1 active paid)

-- Orphan duplicate (phone/OTP session, no email):
--   id:    128a6513-a018-41c1-9b42-dc23cab42a28
--   email: NULL
--   profile full_name: "QA Customer One" (same display name as canonical)
--   orders: 1 reserved/paid (B32UYL) — shows 0 impact in app if logged in via wrong session

-- Safe verification query (read-only):
SELECT u.id, u.email, p.full_name, u.created_at,
       (SELECT count(*) FROM orders o WHERE o.customer_id = u.id) AS order_count
FROM auth.users u
LEFT JOIN profiles p ON p.id = u.id
WHERE u.id IN (
  '571aadc0-d2e6-43bf-bab7-03a35ce3ef7f',
  '128a6513-a018-41c1-9b42-dc23cab42a28'
);

-- Recommendation: DO NOT merge or delete 128a6513… without manual review.
-- Always log in as qa.customer@freshasever.test (email + password), not OTP on a bare profile.
-- Optional future cleanup (NOT applied): archive orphan profile after confirming no FK refs
-- and reassigning order B32UYL to canonical customer — requires product owner sign-off.
