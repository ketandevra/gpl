-- Manual slip draw, league/knockout fixture metadata, and atomic generators.

CREATE TYPE tournament_format AS ENUM ('league_knockout');
CREATE TYPE tournament_draw_status AS ENUM ('pending', 'in_progress', 'confirmed');
CREATE TYPE tournament_league_method AS ENUM ('minimum', 'round_robin');
CREATE TYPE tournament_stage AS ENUM ('setup', 'draw', 'league', 'knockout', 'completed');
CREATE TYPE fixture_stage AS ENUM ('league', 'knockout');

ALTER TABLE tournaments
  ADD COLUMN IF NOT EXISTS format tournament_format NOT NULL DEFAULT 'league_knockout',
  ADD COLUMN IF NOT EXISTS min_league_matches integer NOT NULL DEFAULT 2,
  ADD COLUMN IF NOT EXISTS knockout_qualifiers integer NOT NULL DEFAULT 4,
  ADD COLUMN IF NOT EXISTS league_method tournament_league_method NOT NULL DEFAULT 'minimum',
  ADD COLUMN IF NOT EXISTS draw_status tournament_draw_status NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS draw_confirmed_at timestamptz,
  ADD COLUMN IF NOT EXISTS draw_confirmed_by uuid REFERENCES users (id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS participant_team_ids uuid[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS league_fixtures_confirmed boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS league_fixtures_confirmed_at timestamptz,
  ADD COLUMN IF NOT EXISTS league_stage_completed boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS league_stage_completed_at timestamptz,
  ADD COLUMN IF NOT EXISTS current_stage tournament_stage NOT NULL DEFAULT 'setup',
  ADD COLUMN IF NOT EXISTS league_batch_id uuid,
  ADD COLUMN IF NOT EXISTS knockout_batch_id uuid,
  ADD COLUMN IF NOT EXISTS champion_team_id uuid REFERENCES teams (id) ON DELETE SET NULL;

ALTER TABLE tournaments
  DROP CONSTRAINT IF EXISTS tournaments_min_league_matches_check,
  DROP CONSTRAINT IF EXISTS tournaments_knockout_qualifiers_check;

ALTER TABLE tournaments
  ADD CONSTRAINT tournaments_min_league_matches_check
    CHECK (min_league_matches >= 1 AND min_league_matches <= 32),
  ADD CONSTRAINT tournaments_knockout_qualifiers_check
    CHECK (knockout_qualifiers IN (2, 4, 8, 16));

CREATE TABLE IF NOT EXISTS tournament_draw (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tournament_id uuid NOT NULL REFERENCES tournaments (id) ON DELETE CASCADE,
  team_id uuid NOT NULL REFERENCES teams (id) ON DELETE CASCADE,
  draw_position integer NOT NULL,
  drawn_at timestamptz NOT NULL DEFAULT now(),
  drawn_by uuid REFERENCES users (id) ON DELETE SET NULL,
  CONSTRAINT tournament_draw_position_positive CHECK (draw_position >= 1),
  CONSTRAINT tournament_draw_tournament_team_unique UNIQUE (tournament_id, team_id),
  CONSTRAINT tournament_draw_tournament_position_unique UNIQUE (tournament_id, draw_position)
);

CREATE INDEX IF NOT EXISTS tournament_draw_tournament_idx
  ON tournament_draw (tournament_id, draw_position);

CREATE TABLE IF NOT EXISTS tournament_knockout_slots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tournament_id uuid NOT NULL REFERENCES tournaments (id) ON DELETE CASCADE,
  slot_key text NOT NULL,
  team_id uuid REFERENCES teams (id) ON DELETE SET NULL,
  source text NOT NULL CHECK (source IN ('seed', 'bye', 'winner')),
  source_match_key text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT tournament_knockout_slots_unique UNIQUE (tournament_id, slot_key)
);

CREATE INDEX IF NOT EXISTS tournament_knockout_slots_tournament_idx
  ON tournament_knockout_slots (tournament_id);

ALTER TABLE matches
  ADD COLUMN IF NOT EXISTS stage fixture_stage NOT NULL DEFAULT 'league',
  ADD COLUMN IF NOT EXISTS round_number integer,
  ADD COLUMN IF NOT EXISTS match_number integer,
  ADD COLUMN IF NOT EXISTS generated_batch_id uuid,
  ADD COLUMN IF NOT EXISTS knockout_key text,
  ADD COLUMN IF NOT EXISTS feeds_key text;

CREATE INDEX IF NOT EXISTS matches_tournament_stage_idx
  ON matches (tournament_id, stage, round_number);

CREATE INDEX IF NOT EXISTS matches_generated_batch_idx
  ON matches (generated_batch_id);

CREATE UNIQUE INDEX IF NOT EXISTS matches_tournament_knockout_key_unique
  ON matches (tournament_id, knockout_key)
  WHERE knockout_key IS NOT NULL;

ALTER TABLE matches
  DROP CONSTRAINT IF EXISTS matches_same_tournament_teams;

ALTER TABLE matches
  ADD CONSTRAINT matches_same_tournament_teams CHECK (team_a_id <> team_b_id);

CREATE OR REPLACE FUNCTION replace_generated_league_fixtures(
  p_tournament_id uuid,
  p_batch_id uuid,
  p_matches jsonb,
  p_replace_scheduled boolean DEFAULT false
) RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  inserted integer := 0;
  item jsonb;
  team_a uuid;
  team_b uuid;
BEGIN
  IF p_matches IS NULL OR jsonb_typeof(p_matches) <> 'array' OR jsonb_array_length(p_matches) = 0 THEN
    RAISE EXCEPTION 'No league fixtures to save.';
  END IF;

  PERFORM 1 FROM tournaments WHERE id = p_tournament_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Tournament not found.';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM matches
    WHERE tournament_id = p_tournament_id
      AND stage = 'league'
      AND generated_batch_id IS NOT NULL
      AND status NOT IN ('scheduled', 'cancelled', 'postponed')
  ) THEN
    RAISE EXCEPTION 'Cannot replace league fixtures after matches have started or been completed.';
  END IF;

  IF p_replace_scheduled THEN
    DELETE FROM matches
    WHERE tournament_id = p_tournament_id
      AND stage = 'league'
      AND generated_batch_id IS NOT NULL
      AND status IN ('scheduled', 'cancelled', 'postponed');
  ELSIF EXISTS (
    SELECT 1
    FROM matches
    WHERE tournament_id = p_tournament_id
      AND stage = 'league'
      AND generated_batch_id IS NOT NULL
  ) THEN
    RAISE EXCEPTION 'League fixtures already exist for this tournament.';
  END IF;

  FOR item IN SELECT * FROM jsonb_array_elements(p_matches)
  LOOP
    team_a := (item->>'team_a_id')::uuid;
    team_b := (item->>'team_b_id')::uuid;

    IF team_a IS NULL OR team_b IS NULL OR team_a = team_b THEN
      RAISE EXCEPTION 'Each fixture needs two different teams.';
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM teams
      WHERE id = team_a AND tournament_id = p_tournament_id
    ) OR NOT EXISTS (
      SELECT 1 FROM teams
      WHERE id = team_b AND tournament_id = p_tournament_id
    ) THEN
      RAISE EXCEPTION 'Both teams must belong to this tournament.';
    END IF;

    INSERT INTO matches (
      tournament_id,
      team_a_id,
      team_b_id,
      match_type,
      stage,
      round_number,
      match_number,
      generated_batch_id,
      scheduled_at,
      venue,
      overs_per_innings,
      status
    ) VALUES (
      p_tournament_id,
      team_a,
      team_b,
      'league',
      'league',
      NULLIF(item->>'round_number', '')::integer,
      NULLIF(item->>'match_number', '')::integer,
      p_batch_id,
      NULLIF(item->>'scheduled_at', '')::timestamptz,
      NULLIF(item->>'venue', ''),
      COALESCE(NULLIF(item->>'overs_per_innings', '')::integer, 20),
      'scheduled'
    );
    inserted := inserted + 1;
  END LOOP;

  UPDATE tournaments
  SET
    league_batch_id = p_batch_id,
    league_fixtures_confirmed = true,
    league_fixtures_confirmed_at = now(),
    current_stage = 'league',
    updated_at = now()
  WHERE id = p_tournament_id;

  RETURN inserted;
END;
$$;

CREATE OR REPLACE FUNCTION replace_generated_knockout_fixtures(
  p_tournament_id uuid,
  p_batch_id uuid,
  p_matches jsonb,
  p_slots jsonb,
  p_replace_scheduled boolean DEFAULT false
) RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  inserted integer := 0;
  item jsonb;
  slot jsonb;
  team_a uuid;
  team_b uuid;
  match_kind match_type;
BEGIN
  IF p_matches IS NULL OR jsonb_typeof(p_matches) <> 'array' OR jsonb_array_length(p_matches) = 0 THEN
    RAISE EXCEPTION 'No knockout fixtures to save.';
  END IF;

  PERFORM 1 FROM tournaments WHERE id = p_tournament_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Tournament not found.';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM matches
    WHERE tournament_id = p_tournament_id
      AND stage = 'knockout'
      AND generated_batch_id IS NOT NULL
      AND status NOT IN ('scheduled', 'cancelled', 'postponed')
  ) THEN
    RAISE EXCEPTION 'Cannot replace knockout fixtures after matches have started or been completed.';
  END IF;

  IF p_replace_scheduled THEN
    DELETE FROM matches
    WHERE tournament_id = p_tournament_id
      AND stage = 'knockout'
      AND generated_batch_id IS NOT NULL
      AND status IN ('scheduled', 'cancelled', 'postponed');
    DELETE FROM tournament_knockout_slots
    WHERE tournament_id = p_tournament_id;
  ELSIF EXISTS (
    SELECT 1
    FROM matches
    WHERE tournament_id = p_tournament_id
      AND stage = 'knockout'
      AND generated_batch_id IS NOT NULL
  ) THEN
    RAISE EXCEPTION 'Knockout fixtures already exist for this tournament.';
  END IF;

  IF p_slots IS NOT NULL AND jsonb_typeof(p_slots) = 'array' THEN
    FOR slot IN SELECT * FROM jsonb_array_elements(p_slots)
    LOOP
      INSERT INTO tournament_knockout_slots (
        tournament_id, slot_key, team_id, source, source_match_key
      ) VALUES (
        p_tournament_id,
        slot->>'slot_key',
        NULLIF(slot->>'team_id', '')::uuid,
        COALESCE(slot->>'source', 'bye'),
        NULLIF(slot->>'source_match_key', '')
      )
      ON CONFLICT (tournament_id, slot_key) DO UPDATE
      SET
        team_id = EXCLUDED.team_id,
        source = EXCLUDED.source,
        source_match_key = EXCLUDED.source_match_key,
        updated_at = now();
    END LOOP;
  END IF;

  FOR item IN SELECT * FROM jsonb_array_elements(p_matches)
  LOOP
    team_a := (item->>'team_a_id')::uuid;
    team_b := (item->>'team_b_id')::uuid;
    match_kind := COALESCE(item->>'match_type', 'prelim')::match_type;

    IF team_a IS NULL OR team_b IS NULL OR team_a = team_b THEN
      RAISE EXCEPTION 'Each playable knockout match needs two different teams.';
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM teams WHERE id = team_a AND tournament_id = p_tournament_id
    ) OR NOT EXISTS (
      SELECT 1 FROM teams WHERE id = team_b AND tournament_id = p_tournament_id
    ) THEN
      RAISE EXCEPTION 'Both knockout teams must belong to this tournament.';
    END IF;

    INSERT INTO matches (
      tournament_id,
      team_a_id,
      team_b_id,
      match_type,
      stage,
      round_number,
      match_number,
      generated_batch_id,
      knockout_key,
      feeds_key,
      scheduled_at,
      venue,
      overs_per_innings,
      status
    ) VALUES (
      p_tournament_id,
      team_a,
      team_b,
      match_kind,
      'knockout',
      NULLIF(item->>'round_number', '')::integer,
      NULLIF(item->>'match_number', '')::integer,
      p_batch_id,
      NULLIF(item->>'knockout_key', ''),
      NULLIF(item->>'feeds_key', ''),
      NULLIF(item->>'scheduled_at', '')::timestamptz,
      NULLIF(item->>'venue', ''),
      COALESCE(NULLIF(item->>'overs_per_innings', '')::integer, 20),
      'scheduled'
    );
    inserted := inserted + 1;
  END LOOP;

  UPDATE tournaments
  SET
    knockout_batch_id = p_batch_id,
    current_stage = 'knockout',
    updated_at = now()
  WHERE id = p_tournament_id;

  RETURN inserted;
END;
$$;

REVOKE ALL ON FUNCTION replace_generated_league_fixtures(uuid, uuid, jsonb, boolean) FROM PUBLIC;
REVOKE ALL ON FUNCTION replace_generated_knockout_fixtures(uuid, uuid, jsonb, jsonb, boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION replace_generated_league_fixtures(uuid, uuid, jsonb, boolean) TO service_role;
GRANT EXECUTE ON FUNCTION replace_generated_knockout_fixtures(uuid, uuid, jsonb, jsonb, boolean) TO service_role;

ALTER TABLE tournament_draw ENABLE ROW LEVEL SECURITY;
ALTER TABLE tournament_knockout_slots ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tournament_draw_select_public ON tournament_draw;
CREATE POLICY tournament_draw_select_public
  ON tournament_draw
  FOR SELECT
  TO anon, authenticated
  USING (true);

DROP POLICY IF EXISTS tournament_knockout_slots_select_public ON tournament_knockout_slots;
CREATE POLICY tournament_knockout_slots_select_public
  ON tournament_knockout_slots
  FOR SELECT
  TO anon, authenticated
  USING (true);
