-- Wipe all GPL app data; keep only GPL Admin.
-- Run in Supabase SQL Editor (as postgres / service role).
--
-- Keeps:
--   - GPL Admin (mobile 9636933097)
--   - app_settings row
--
-- Clears:
--   - users (except admin), sessions, login attempts
--   - tournaments, teams, players, team_players
--   - matches, match_scorers, innings, balls
--   - verification documents + Aadhaar storage objects
--   - audit logs
--
-- After this, create a tournament in Admin if you need registration/scoring.

BEGIN;

-- Clear domain + auth satellite data (order doesn't matter with CASCADE)
TRUNCATE TABLE
  balls,
  innings,
  match_scorers,
  matches,
  team_invites,
  team_owner_requests,
  team_players,
  players,
  teams,
  verification_documents,
  audit_logs,
  sessions,
  login_attempts,
  tournaments
RESTART IDENTITY CASCADE;

-- Remove every user except GPL Admin
DELETE FROM users
WHERE id <> '11111111-1111-1111-1111-111111111101';

-- Ensure GPL Admin exists (insert if missing / refresh core fields)
INSERT INTO users (
  id,
  name,
  mobile_number,
  pin_hash,
  role,
  is_active,
  verification_status,
  aadhaar_number,
  verification_submitted_at,
  verification_reviewed_at,
  verification_reviewed_by,
  verification_rejection_reason,
  failed_login_attempts,
  locked_until,
  last_login_at
) VALUES (
  '11111111-1111-1111-1111-111111111101',
  'GPL Admin',
  '9636933097',
  '$2b$12$8sNkIIB.DyEEDjrzPmjqx.Y0K/TC.rLobw3HdK14WTNhi/S/f0gZy',
  'admin',
  true,
  'verified',
  NULL,
  NULL,
  NULL,
  NULL,
  NULL,
  0,
  NULL,
  NULL
)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  mobile_number = EXCLUDED.mobile_number,
  pin_hash = EXCLUDED.pin_hash,
  role = 'admin',
  is_active = true,
  verification_status = 'verified',
  aadhaar_number = NULL,
  verification_submitted_at = NULL,
  verification_reviewed_at = NULL,
  verification_reviewed_by = NULL,
  verification_rejection_reason = NULL,
  failed_login_attempts = 0,
  locked_until = NULL,
  updated_at = now();

-- Reset global toggles
UPDATE app_settings
SET user_registration_open = false,
    updated_at = now()
WHERE id = 1;

INSERT INTO app_settings (id, user_registration_open)
VALUES (1, false)
ON CONFLICT (id) DO NOTHING;

-- Note: Aadhaar files in Storage bucket `aadhaar-docs` cannot be deleted via SQL
-- (Supabase blocks direct storage.objects deletes). Clear them in Dashboard →
-- Storage → aadhaar-docs, or leave orphans (DB rows are already truncated).

COMMIT;

-- Sanity check (should return 1 row: GPL Admin)
-- SELECT id, name, mobile_number, role FROM users;
