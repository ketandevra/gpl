-- Phase: tournament player pool + team membership + exclusive approved lock
--
-- Before: players.team_id required (player owned by exactly one team).
-- After:  players belong to a tournament; team_players is membership.
--         pending teams may share players; approved lock is players.locked_team_id
--         set atomically via approve_team() under row locks.
--
-- Safe to re-run after partial failures.

-- ---------------------------------------------------------------------------
-- 1) Extend players
-- ---------------------------------------------------------------------------

ALTER TABLE players
  ADD COLUMN IF NOT EXISTS tournament_id uuid REFERENCES tournaments (id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS public_code text,
  ADD COLUMN IF NOT EXISTS locked_team_id uuid REFERENCES teams (id) ON DELETE SET NULL;

-- Backfill tournament from current team (only while team_id still exists)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'players' AND column_name = 'team_id'
  ) THEN
    UPDATE players p
    SET tournament_id = t.tournament_id
    FROM teams t
    WHERE t.id = p.team_id
      AND p.tournament_id IS NULL;
  END IF;
END $$;

-- If tournament_id still null (e.g. team_id already dropped), attach to active/first tournament
UPDATE players p
SET tournament_id = (
  SELECT t.id FROM tournaments t ORDER BY t.is_active DESC, t.created_at ASC LIMIT 1
)
WHERE p.tournament_id IS NULL;

-- Assign stable public codes within each tournament (P001…)
WITH ordered AS (
  SELECT
    id,
    tournament_id,
    row_number() OVER (PARTITION BY tournament_id ORDER BY created_at, id) AS rn
  FROM players
  WHERE tournament_id IS NOT NULL
    AND (public_code IS NULL OR public_code = '')
)
UPDATE players p
SET public_code = 'P' || lpad(ordered.rn::text, 3, '0')
FROM ordered
WHERE p.id = ordered.id;

-- Ensure every row has a code even if some already had codes (fill gaps only)
WITH ordered AS (
  SELECT
    id,
    row_number() OVER (PARTITION BY tournament_id ORDER BY created_at, id) AS rn
  FROM players
  WHERE tournament_id IS NOT NULL
    AND (public_code IS NULL OR public_code = '')
)
UPDATE players p
SET public_code = 'P' || lpad(ordered.rn::text, 3, '0')
FROM ordered
WHERE p.id = ordered.id;

ALTER TABLE players
  ALTER COLUMN tournament_id SET NOT NULL;

-- public_code may still be null if table empty; only enforce when rows exist
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM players WHERE public_code IS NULL OR public_code = '') THEN
    RAISE EXCEPTION 'players.public_code backfill incomplete';
  END IF;
  ALTER TABLE players ALTER COLUMN public_code SET NOT NULL;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS players_tournament_public_code_unique
  ON players (tournament_id, public_code);

CREATE INDEX IF NOT EXISTS players_tournament_name_idx
  ON players (tournament_id, lower(name));

CREATE INDEX IF NOT EXISTS players_tournament_mobile_idx
  ON players (tournament_id, mobile_number)
  WHERE mobile_number IS NOT NULL;

CREATE INDEX IF NOT EXISTS players_locked_team_idx
  ON players (locked_team_id)
  WHERE locked_team_id IS NOT NULL;

-- ---------------------------------------------------------------------------
-- 2) Membership table (create BEFORE any policy that references it)
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS team_players (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id uuid NOT NULL REFERENCES teams (id) ON DELETE CASCADE,
  player_id uuid NOT NULL REFERENCES players (id) ON DELETE CASCADE,
  jersey_number integer,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT team_players_unique UNIQUE (team_id, player_id),
  CONSTRAINT team_players_jersey_positive
    CHECK (jersey_number IS NULL OR jersey_number BETWEEN 0 AND 999)
);

CREATE UNIQUE INDEX IF NOT EXISTS team_players_team_jersey_unique
  ON team_players (team_id, jersey_number)
  WHERE jersey_number IS NOT NULL;

CREATE INDEX IF NOT EXISTS team_players_player_idx ON team_players (player_id);

-- Migrate existing ownership into memberships (only while team_id still exists)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'players' AND column_name = 'team_id'
  ) THEN
    INSERT INTO team_players (team_id, player_id, jersey_number)
    SELECT p.team_id, p.id, p.jersey_number
    FROM players p
    WHERE p.team_id IS NOT NULL
    ON CONFLICT (team_id, player_id) DO NOTHING;

    UPDATE players p
    SET locked_team_id = p.team_id
    FROM teams t
    WHERE t.id = p.team_id
      AND t.approved = true
      AND p.locked_team_id IS NULL;
  END IF;
END $$;

-- Drop old team ownership on players
DROP POLICY IF EXISTS players_select_approved_public ON players;

ALTER TABLE players DROP CONSTRAINT IF EXISTS players_team_jersey_unique;
ALTER TABLE players DROP CONSTRAINT IF EXISTS players_team_id_fkey;

ALTER TABLE players DROP COLUMN IF EXISTS team_id;
ALTER TABLE players DROP COLUMN IF EXISTS jersey_number;

-- Public can see players who are on an approved team (via membership or lock).
DROP POLICY IF EXISTS players_select_approved_public ON public.players;
DROP POLICY IF EXISTS players_select_public ON public.players;
CREATE POLICY players_select_approved_public
  ON public.players
  FOR SELECT
  TO anon, authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.team_players tp
      JOIN public.teams t ON t.id = tp.team_id
      WHERE tp.player_id = players.id
        AND t.approved = true
        AND t.registration_status = 'approved'
    )
    OR EXISTS (
      SELECT 1
      FROM public.teams t
      WHERE t.id = players.locked_team_id
        AND t.approved = true
        AND t.registration_status = 'approved'
    )
  );

ALTER TABLE public.team_players ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS team_players_select_approved_public ON public.team_players;
CREATE POLICY team_players_select_approved_public
  ON public.team_players
  FOR SELECT
  TO anon, authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.teams t
      WHERE t.id = team_players.team_id
        AND t.approved = true
        AND t.registration_status = 'approved'
    )
  );

-- Locked team must be same tournament (trigger)
CREATE OR REPLACE FUNCTION players_locked_team_same_tournament()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.locked_team_id IS NULL THEN
    RETURN NEW;
  END IF;
  IF NOT EXISTS (
    SELECT 1
    FROM teams t
    WHERE t.id = NEW.locked_team_id
      AND t.tournament_id = NEW.tournament_id
  ) THEN
    RAISE EXCEPTION 'locked_team_id must belong to the same tournament';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_players_locked_team_same_tournament ON players;
CREATE TRIGGER trg_players_locked_team_same_tournament
  BEFORE INSERT OR UPDATE OF locked_team_id, tournament_id
  ON players
  FOR EACH ROW
  EXECUTE FUNCTION players_locked_team_same_tournament();

-- Membership player must share tournament with team
CREATE OR REPLACE FUNCTION team_players_same_tournament()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_team_tournament uuid;
  v_player_tournament uuid;
BEGIN
  SELECT tournament_id INTO v_team_tournament FROM teams WHERE id = NEW.team_id;
  SELECT tournament_id INTO v_player_tournament FROM players WHERE id = NEW.player_id;
  IF v_team_tournament IS DISTINCT FROM v_player_tournament THEN
    RAISE EXCEPTION 'team_players: player and team must share a tournament';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_team_players_same_tournament ON team_players;
CREATE TRIGGER trg_team_players_same_tournament
  BEFORE INSERT OR UPDATE OF team_id, player_id
  ON team_players
  FOR EACH ROW
  EXECUTE FUNCTION team_players_same_tournament();

-- ---------------------------------------------------------------------------
-- 3) Atomic approve + roster replace
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

  -- Serialize claims for these players (stable order avoids deadlocks)
  PERFORM 1
  FROM players p
  WHERE p.id = ANY (v_player_ids)
  ORDER BY p.id
  FOR UPDATE;

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

-- Replace roster for an approved team (or pending) atomically.
-- p_members: [{"player_id":"...","jersey_number":7}, ...]
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

  -- Reject duplicate player_ids in payload
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

  -- Lock all involved players: current roster + new roster
  PERFORM 1
  FROM players p
  WHERE p.id IN (
    SELECT player_id FROM team_players WHERE team_id = p_team_id
    UNION
    SELECT unnest(v_new_ids)
  )
  ORDER BY p.id
  FOR UPDATE;

  -- Conflicts: new players locked to a different approved team
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

  -- Clear locks for players removed from an approved team
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
