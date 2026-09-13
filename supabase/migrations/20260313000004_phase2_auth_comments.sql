-- Phase 2 security notes (no structural table changes required).
-- Auth writes remain server-side via service role.
-- Reinforce: pin_hash must never be selectable by anon/authenticated.

COMMENT ON COLUMN users.pin_hash IS
  'bcrypt/argon2 hash of 4-digit PIN. Never expose via API or views.';

COMMENT ON TABLE sessions IS
  'Server-managed sessions. Cookie stores raw token; DB stores SHA-256 hash only.';

COMMENT ON TABLE login_attempts IS
  'Failed/successful login audit for rate limiting. Server-only access.';
