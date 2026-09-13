-- Permanently replace all users with a single GPL Admin.
-- Safe to run in SQL Editor (Run without RLS).

BEGIN;

DELETE FROM sessions;
DELETE FROM login_attempts;
DELETE FROM match_scorers;

UPDATE teams SET manager_id = NULL;
UPDATE audit_logs SET actor_id = NULL;

DELETE FROM users;

INSERT INTO users (id, name, mobile_number, pin_hash, role, is_active)
VALUES (
  '11111111-1111-1111-1111-111111111101',
  'GPL Admin',
  '9636933097',
  '$2b$12$8sNkIIB.DyEEDjrzPmjqx.Y0K/TC.rLobw3HdK14WTNhi/S/f0gZy',
  'admin',
  true
);

-- Point existing seeded teams at the new admin (optional ownership)
UPDATE teams
SET manager_id = '11111111-1111-1111-1111-111111111101'
WHERE tournament_id = '22222222-2222-2222-2222-222222222201';

COMMIT;
