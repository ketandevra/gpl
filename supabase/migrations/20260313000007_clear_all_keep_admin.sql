-- One-click reset: wipe tournament/auth data; keep only GPL Admin.
-- Invoked by Next.js admin API via service_role (never expose to anon).

CREATE OR REPLACE FUNCTION public.clear_all_keep_admin()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_admin_id uuid := '11111111-1111-1111-1111-111111111101';
  v_admin_pin text := '$2b$12$8sNkIIB.DyEEDjrzPmjqx.Y0K/TC.rLobw3HdK14WTNhi/S/f0gZy';
  v_existing_pin text;
BEGIN
  TRUNCATE TABLE
    balls,
    innings,
    match_scorers,
    matches,
    team_players,
    players,
    teams,
    verification_documents,
    audit_logs,
    sessions,
    login_attempts,
    tournaments
  RESTART IDENTITY CASCADE;

  DELETE FROM users WHERE id <> v_admin_id;

  SELECT pin_hash INTO v_existing_pin FROM users WHERE id = v_admin_id;

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
    v_admin_id,
    'GPL Admin',
    '9636933097',
    coalesce(v_existing_pin, v_admin_pin),
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
    name = 'GPL Admin',
    mobile_number = '9636933097',
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
    -- pin_hash intentionally preserved

  UPDATE app_settings
  SET user_registration_open = false,
      updated_at = now()
  WHERE id = 1;

  INSERT INTO app_settings (id, user_registration_open)
  VALUES (1, false)
  ON CONFLICT (id) DO NOTHING;

  RETURN jsonb_build_object('ok', true, 'kept_admin_id', v_admin_id);
END;
$$;

REVOKE ALL ON FUNCTION public.clear_all_keep_admin() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.clear_all_keep_admin() TO service_role;
