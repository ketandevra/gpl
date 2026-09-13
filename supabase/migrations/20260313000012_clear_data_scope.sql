-- Scoped Danger zone wipes (matches / teams / players / users / tournaments / verifications / all)

CREATE OR REPLACE FUNCTION public.clear_data_scope(
  p_scope text,
  p_keep_user_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_admin_id uuid := '11111111-1111-1111-1111-111111111101';
  v_scope text := lower(btrim(p_scope));
  v_admin_pin text := '$2b$12$8sNkIIB.DyEEDjrzPmjqx.Y0K/TC.rLobw3HdK14WTNhi/S/f0gZy';
  v_existing_pin text;
BEGIN
  IF v_scope NOT IN (
    'matches',
    'teams',
    'players',
    'users',
    'tournaments',
    'verifications',
    'all'
  ) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Unknown scope');
  END IF;

  -- Fixtures + scorecards
  IF v_scope IN ('matches', 'teams', 'tournaments', 'all') THEN
    TRUNCATE TABLE balls, innings, match_scorers, matches RESTART IDENTITY CASCADE;
  END IF;

  -- Teams (matches already gone when required)
  IF v_scope IN ('teams', 'tournaments', 'all') THEN
    UPDATE players SET locked_team_id = NULL WHERE locked_team_id IS NOT NULL;
    TRUNCATE TABLE team_players, teams RESTART IDENTITY CASCADE;
  END IF;

  -- Player registry
  IF v_scope IN ('players', 'tournaments', 'all') THEN
    UPDATE innings SET striker_id = NULL, non_striker_id = NULL, bowler_id = NULL;
    UPDATE balls SET
      striker_id = NULL,
      non_striker_id = NULL,
      bowler_id = NULL,
      dismissed_player_id = NULL;
    TRUNCATE TABLE team_players RESTART IDENTITY CASCADE;
    DELETE FROM players;
  END IF;

  IF v_scope IN ('tournaments', 'all') THEN
    TRUNCATE TABLE tournaments RESTART IDENTITY CASCADE;
  END IF;

  IF v_scope = 'verifications' THEN
    TRUNCATE TABLE verification_documents RESTART IDENTITY CASCADE;
    UPDATE users
    SET
      aadhaar_number = NULL,
      verification_submitted_at = NULL,
      verification_reviewed_at = NULL,
      verification_reviewed_by = NULL,
      verification_rejection_reason = NULL,
      verification_status = CASE
        WHEN id = v_admin_id OR id = p_keep_user_id THEN verification_status
        ELSE 'unverified'
      END,
      updated_at = now();
  ELSIF v_scope IN ('users', 'all') THEN
    DELETE FROM verification_documents
    WHERE user_id <> v_admin_id
      AND (p_keep_user_id IS NULL OR user_id <> p_keep_user_id);
  END IF;

  IF v_scope IN ('users', 'all') THEN
    UPDATE teams SET manager_id = NULL WHERE manager_id IS NOT NULL;
    UPDATE players SET user_id = NULL WHERE user_id IS NOT NULL;
    DELETE FROM match_scorers
    WHERE user_id <> v_admin_id
      AND (p_keep_user_id IS NULL OR user_id <> p_keep_user_id);
    DELETE FROM sessions
    WHERE user_id <> v_admin_id
      AND (p_keep_user_id IS NULL OR user_id <> p_keep_user_id);
    DELETE FROM users
    WHERE id <> v_admin_id
      AND (p_keep_user_id IS NULL OR id <> p_keep_user_id);
  END IF;

  IF v_scope = 'all' THEN
    TRUNCATE TABLE login_attempts, sessions RESTART IDENTITY CASCADE;

    SELECT pin_hash INTO v_existing_pin FROM users WHERE id = v_admin_id;

    INSERT INTO users (
      id, name, mobile_number, pin_hash, role, is_active, verification_status,
      aadhaar_number, verification_submitted_at, verification_reviewed_at,
      verification_reviewed_by, verification_rejection_reason,
      failed_login_attempts, locked_until, last_login_at
    ) VALUES (
      v_admin_id, 'GPL Admin', '9636933097',
      coalesce(v_existing_pin, v_admin_pin),
      'admin', true, 'verified',
      NULL, NULL, NULL, NULL, NULL, 0, NULL, NULL
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

    UPDATE app_settings
    SET user_registration_open = false, updated_at = now()
    WHERE id = 1;

    INSERT INTO app_settings (id, user_registration_open)
    VALUES (1, false)
    ON CONFLICT (id) DO NOTHING;
  END IF;

  RETURN jsonb_build_object('ok', true, 'scope', v_scope);
END;
$$;

REVOKE ALL ON FUNCTION public.clear_data_scope(text, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.clear_data_scope(text, uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.clear_all_keep_admin()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN public.clear_data_scope('all', NULL);
END;
$$;

REVOKE ALL ON FUNCTION public.clear_all_keep_admin() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.clear_all_keep_admin() TO service_role;
