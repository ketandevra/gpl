-- User identity verification (Aadhaar) + link tournament players to users
-- Privacy: Aadhaar images in private storage; numbers never public.
--
-- REQUIRES migration 20260313000005_player_membership.sql first
-- (players.tournament_id / public_code / locked_team_id / team_players).

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'players'
      AND column_name = 'tournament_id'
  ) THEN
    RAISE EXCEPTION
      'players.tournament_id is missing. Run 20260313000005_player_membership.sql BEFORE this migration, then re-run 00006.';
  END IF;
END $$;

CREATE TYPE verification_status AS ENUM (
  'unverified',
  'pending',
  'verified',
  'rejected'
);

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS verification_status verification_status NOT NULL DEFAULT 'unverified',
  ADD COLUMN IF NOT EXISTS aadhaar_number text,
  ADD COLUMN IF NOT EXISTS verification_submitted_at timestamptz,
  ADD COLUMN IF NOT EXISTS verification_reviewed_at timestamptz,
  ADD COLUMN IF NOT EXISTS verification_reviewed_by uuid REFERENCES users (id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS verification_rejection_reason text;

ALTER TABLE users DROP CONSTRAINT IF EXISTS users_aadhaar_number_format;
ALTER TABLE users
  ADD CONSTRAINT users_aadhaar_number_format
  CHECK (aadhaar_number IS NULL OR aadhaar_number ~ '^[0-9]{12}$');

CREATE UNIQUE INDEX IF NOT EXISTS users_aadhaar_number_unique
  ON users (aadhaar_number)
  WHERE aadhaar_number IS NOT NULL;

CREATE INDEX IF NOT EXISTS users_verification_status_idx
  ON users (verification_status);

-- ---------------------------------------------------------------------------
-- Verification documents (private storage paths only)
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS verification_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  doc_type text NOT NULL,
  storage_path text NOT NULL,
  mime_type text NOT NULL,
  file_size integer NOT NULL CHECK (file_size > 0 AND file_size <= 2097152),
  uploaded_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT verification_documents_doc_type_valid
    CHECK (doc_type IN ('aadhaar_front', 'aadhaar_back')),
  CONSTRAINT verification_documents_user_doc_unique UNIQUE (user_id, doc_type)
);

CREATE INDEX IF NOT EXISTS verification_documents_user_idx
  ON verification_documents (user_id);

ALTER TABLE verification_documents ENABLE ROW LEVEL SECURITY;
-- No anon/authenticated policies — access only via service role (Next.js server).

-- ---------------------------------------------------------------------------
-- Link players to users (identity)
-- ---------------------------------------------------------------------------

ALTER TABLE players
  ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES users (id) ON DELETE SET NULL;

CREATE UNIQUE INDEX IF NOT EXISTS players_tournament_user_unique
  ON players (tournament_id, user_id)
  WHERE user_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS players_user_id_idx ON players (user_id);

-- ---------------------------------------------------------------------------
-- Atomic approve: also require linked user is verified
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.approve_team(p_team_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_team teams%ROWTYPE;
  v_player_ids uuid[];
  v_conflicts jsonb;
  v_unverified jsonb;
  v_updated int;
BEGIN
  SELECT * INTO v_team
  FROM teams
  WHERE id = p_team_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Team not found.');
  END IF;

  IF v_team.registration_status = 'approved' AND v_team.approved THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Team is already approved.');
  END IF;

  SELECT coalesce(array_agg(tp.player_id ORDER BY tp.player_id), ARRAY[]::uuid[])
  INTO v_player_ids
  FROM team_players tp
  WHERE tp.team_id = p_team_id;

  IF coalesce(cardinality(v_player_ids), 0) = 0 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Team has no players.');
  END IF;

  PERFORM 1
  FROM players p
  WHERE p.id = ANY (v_player_ids)
  ORDER BY p.id
  FOR UPDATE;

  -- Every roster player must be linked to a verified user
  SELECT coalesce(
    jsonb_agg(
      jsonb_build_object(
        'player_id', p.id,
        'public_code', p.public_code,
        'name', p.name,
        'reason', CASE
          WHEN p.user_id IS NULL THEN 'not_linked'
          WHEN u.verification_status IS DISTINCT FROM 'verified' THEN 'not_verified'
          ELSE 'unknown'
        END
      )
      ORDER BY p.public_code
    ),
    '[]'::jsonb
  )
  INTO v_unverified
  FROM players p
  LEFT JOIN users u ON u.id = p.user_id
  WHERE p.id = ANY (v_player_ids)
    AND (
      p.user_id IS NULL
      OR u.verification_status IS DISTINCT FROM 'verified'
    );

  IF jsonb_array_length(v_unverified) > 0 THEN
    RETURN jsonb_build_object(
      'ok', false,
      'error', 'unverified',
      'unverified', v_unverified
    );
  END IF;

  SELECT coalesce(
    jsonb_agg(
      jsonb_build_object(
        'player_id', p.id,
        'public_code', p.public_code,
        'name', p.name,
        'team_id', t.id,
        'team_name', t.name
      )
      ORDER BY p.public_code
    ),
    '[]'::jsonb
  )
  INTO v_conflicts
  FROM players p
  JOIN teams t ON t.id = p.locked_team_id
  WHERE p.id = ANY (v_player_ids)
    AND p.locked_team_id IS NOT NULL
    AND p.locked_team_id <> p_team_id;

  IF jsonb_array_length(v_conflicts) > 0 THEN
    RETURN jsonb_build_object(
      'ok', false,
      'error', 'conflict',
      'conflicts', v_conflicts
    );
  END IF;

  UPDATE players
  SET locked_team_id = p_team_id,
      updated_at = now()
  WHERE id = ANY (v_player_ids)
    AND (locked_team_id IS NULL OR locked_team_id = p_team_id);

  GET DIAGNOSTICS v_updated = ROW_COUNT;

  IF v_updated <> cardinality(v_player_ids) THEN
    RETURN jsonb_build_object(
      'ok', false,
      'error', 'Could not claim all players. Try again.'
    );
  END IF;

  UPDATE teams
  SET approved = true,
      registration_status = 'approved',
      updated_at = now()
  WHERE id = p_team_id;

  RETURN jsonb_build_object('ok', true, 'team_id', p_team_id);
END;
$$;

REVOKE ALL ON FUNCTION public.approve_team(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.approve_team(uuid) TO service_role;

-- Same verification check on roster replace when team is approved
CREATE OR REPLACE FUNCTION public.set_team_roster(
  p_team_id uuid,
  p_members jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_team teams%ROWTYPE;
  v_new_ids uuid[];
  v_conflicts jsonb;
  v_unverified jsonb;
  v_member jsonb;
  v_player_id uuid;
  v_jersey integer;
BEGIN
  SELECT * INTO v_team FROM teams WHERE id = p_team_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Team not found.');
  END IF;

  IF jsonb_typeof(p_members) <> 'array' OR jsonb_array_length(p_members) < 1 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'At least one player is required.');
  END IF;

  IF (
    SELECT count(*) <> count(DISTINCT value->>'player_id')
    FROM jsonb_array_elements(p_members)
  ) THEN
    RETURN jsonb_build_object(
      'ok', false,
      'error', 'This player is already added to this team.'
    );
  END IF;

  SELECT coalesce(array_agg((m->>'player_id')::uuid ORDER BY (m->>'player_id')), ARRAY[]::uuid[])
  INTO v_new_ids
  FROM jsonb_array_elements(p_members) AS m;

  PERFORM 1
  FROM players p
  WHERE p.id IN (
    SELECT player_id FROM team_players WHERE team_id = p_team_id
    UNION
    SELECT unnest(v_new_ids)
  )
  ORDER BY p.id
  FOR UPDATE;

  SELECT coalesce(
    jsonb_agg(
      jsonb_build_object(
        'player_id', p.id,
        'public_code', p.public_code,
        'name', p.name,
        'reason', CASE
          WHEN p.user_id IS NULL THEN 'not_linked'
          WHEN u.verification_status IS DISTINCT FROM 'verified' THEN 'not_verified'
          ELSE 'unknown'
        END
      )
      ORDER BY p.public_code
    ),
    '[]'::jsonb
  )
  INTO v_unverified
  FROM players p
  LEFT JOIN users u ON u.id = p.user_id
  WHERE p.id = ANY (v_new_ids)
    AND (
      p.user_id IS NULL
      OR u.verification_status IS DISTINCT FROM 'verified'
    );

  IF jsonb_array_length(v_unverified) > 0 THEN
    RETURN jsonb_build_object(
      'ok', false,
      'error', 'unverified',
      'unverified', v_unverified
    );
  END IF;

  SELECT coalesce(
    jsonb_agg(
      jsonb_build_object(
        'player_id', p.id,
        'public_code', p.public_code,
        'name', p.name,
        'team_id', t.id,
        'team_name', t.name
      )
      ORDER BY p.public_code
    ),
    '[]'::jsonb
  )
  INTO v_conflicts
  FROM players p
  JOIN teams t ON t.id = p.locked_team_id
  WHERE p.id = ANY (v_new_ids)
    AND p.locked_team_id IS NOT NULL
    AND p.locked_team_id <> p_team_id;

  IF jsonb_array_length(v_conflicts) > 0 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'conflict', 'conflicts', v_conflicts);
  END IF;

  IF v_team.approved THEN
    UPDATE players
    SET locked_team_id = NULL,
        updated_at = now()
    WHERE locked_team_id = p_team_id
      AND id <> ALL (v_new_ids);
  END IF;

  DELETE FROM team_players WHERE team_id = p_team_id;

  FOR v_member IN SELECT * FROM jsonb_array_elements(p_members)
  LOOP
    v_player_id := (v_member->>'player_id')::uuid;
    v_jersey := NULLIF(v_member->>'jersey_number', '')::integer;
    INSERT INTO team_players (team_id, player_id, jersey_number)
    VALUES (p_team_id, v_player_id, v_jersey);
  END LOOP;

  IF v_team.approved THEN
    UPDATE players
    SET locked_team_id = p_team_id,
        updated_at = now()
    WHERE id = ANY (v_new_ids);
  END IF;

  RETURN jsonb_build_object('ok', true, 'team_id', p_team_id);
END;
$$;

REVOKE ALL ON FUNCTION public.set_team_roster(uuid, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.set_team_roster(uuid, jsonb) TO service_role;

-- ---------------------------------------------------------------------------
-- Private Aadhaar storage bucket (no public policies)
-- ---------------------------------------------------------------------------

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'aadhaar-docs',
  'aadhaar-docs',
  false,
  2097152,
  ARRAY['image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO UPDATE
SET
  public = false,
  file_size_limit = 2097152,
  allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp'];

-- Explicitly: no SELECT/INSERT policies for anon/authenticated on this bucket.
-- Uploads and signed URLs go through the Next.js server + service role.
