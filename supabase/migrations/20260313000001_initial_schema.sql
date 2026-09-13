-- Ghanchi Premier League (GPL) — Phase 1 schema
-- Multi-tournament capable, custom mobile+PIN auth (no Supabase Auth)

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------

CREATE TYPE user_role AS ENUM ('admin', 'scorer', 'team_manager', 'viewer');

CREATE TYPE tournament_status AS ENUM ('upcoming', 'ongoing', 'completed');

CREATE TYPE team_registration_status AS ENUM (
  'draft',
  'pending',
  'approved',
  'rejected'
);

CREATE TYPE player_role AS ENUM (
  'batsman',
  'bowler',
  'all_rounder',
  'wicket_keeper'
);

CREATE TYPE match_type AS ENUM ('league', 'semi', 'final', 'friendly');

CREATE TYPE match_status AS ENUM (
  'scheduled',
  'live',
  'innings_break',
  'completed',
  'abandoned'
);

CREATE TYPE toss_decision AS ENUM ('bat', 'bowl');

CREATE TYPE innings_status AS ENUM ('not_started', 'in_progress', 'completed');

CREATE TYPE extra_type AS ENUM ('wide', 'no_ball', 'bye', 'leg_bye', 'penalty');

CREATE TYPE wicket_type AS ENUM (
  'bowled',
  'caught',
  'lbw',
  'run_out',
  'stumped',
  'hit_wicket',
  'retired_hurt',
  'retired_out'
);

-- ---------------------------------------------------------------------------
-- App settings (separate toggles for user vs team registration)
-- ---------------------------------------------------------------------------

CREATE TABLE app_settings (
  id smallint PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  user_registration_open boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO app_settings (id, user_registration_open) VALUES (1, false);

-- ---------------------------------------------------------------------------
-- Users & auth
-- ---------------------------------------------------------------------------

CREATE TABLE users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  mobile_number text NOT NULL,
  pin_hash text NOT NULL,
  role user_role NOT NULL DEFAULT 'viewer',
  is_active boolean NOT NULL DEFAULT true,
  failed_login_attempts integer NOT NULL DEFAULT 0,
  locked_until timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  last_login_at timestamptz,
  CONSTRAINT users_mobile_number_format
    CHECK (mobile_number ~ '^[6-9][0-9]{9}$'),
  CONSTRAINT users_mobile_number_unique UNIQUE (mobile_number)
);

CREATE TABLE sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  token_hash text NOT NULL,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  user_agent text,
  ip_hash text,
  CONSTRAINT sessions_token_hash_unique UNIQUE (token_hash)
);

CREATE TABLE login_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  mobile_number text NOT NULL,
  success boolean NOT NULL,
  ip_hash text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- Tournaments
-- ---------------------------------------------------------------------------

CREATE TABLE tournaments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  short_name text,
  location text,
  start_date date,
  end_date date,
  registration_open boolean NOT NULL DEFAULT false,
  status tournament_status NOT NULL DEFAULT 'upcoming',
  is_active boolean NOT NULL DEFAULT false,
  points_win integer NOT NULL DEFAULT 2,
  points_tie integer NOT NULL DEFAULT 1,
  points_nr integer NOT NULL DEFAULT 1,
  points_loss integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT tournaments_date_range
    CHECK (end_date IS NULL OR start_date IS NULL OR end_date >= start_date)
);

-- At most one active tournament for homepage focus
CREATE UNIQUE INDEX tournaments_one_active
  ON tournaments (is_active)
  WHERE is_active = true;

-- ---------------------------------------------------------------------------
-- Teams & players
-- ---------------------------------------------------------------------------

CREATE TABLE teams (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tournament_id uuid NOT NULL REFERENCES tournaments (id) ON DELETE CASCADE,
  name text NOT NULL,
  short_name text NOT NULL,
  logo_url text,
  manager_id uuid REFERENCES users (id) ON DELETE SET NULL,
  registration_status team_registration_status NOT NULL DEFAULT 'pending',
  approved boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT teams_tournament_name_unique UNIQUE (tournament_id, name),
  CONSTRAINT teams_tournament_short_name_unique UNIQUE (tournament_id, short_name),
  CONSTRAINT teams_short_name_length CHECK (char_length(short_name) BETWEEN 2 AND 6)
);

CREATE TABLE players (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id uuid NOT NULL REFERENCES teams (id) ON DELETE CASCADE,
  name text NOT NULL,
  mobile_number text,
  jersey_number integer,
  photo_url text,
  role player_role NOT NULL DEFAULT 'batsman',
  batting_style text,
  bowling_style text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT players_mobile_optional_format
    CHECK (mobile_number IS NULL OR mobile_number ~ '^[6-9][0-9]{9}$'),
  CONSTRAINT players_jersey_positive
    CHECK (jersey_number IS NULL OR jersey_number BETWEEN 0 AND 999),
  CONSTRAINT players_team_jersey_unique UNIQUE (team_id, jersey_number)
);

-- ---------------------------------------------------------------------------
-- Matches, scorers, innings, balls
-- ---------------------------------------------------------------------------

CREATE TABLE matches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tournament_id uuid NOT NULL REFERENCES tournaments (id) ON DELETE CASCADE,
  team_a_id uuid NOT NULL REFERENCES teams (id),
  team_b_id uuid NOT NULL REFERENCES teams (id),
  scheduled_at timestamptz,
  venue text,
  match_type match_type NOT NULL DEFAULT 'league',
  overs_per_innings integer NOT NULL DEFAULT 20,
  status match_status NOT NULL DEFAULT 'scheduled',
  toss_winner_id uuid REFERENCES teams (id),
  toss_decision toss_decision,
  winner_team_id uuid REFERENCES teams (id),
  result_text text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT matches_different_teams CHECK (team_a_id <> team_b_id),
  CONSTRAINT matches_overs_positive CHECK (overs_per_innings > 0)
);

CREATE TABLE match_scorers (
  match_id uuid NOT NULL REFERENCES matches (id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  assigned_at timestamptz NOT NULL DEFAULT now(),
  assigned_by uuid REFERENCES users (id) ON DELETE SET NULL,
  PRIMARY KEY (match_id, user_id)
);

CREATE TABLE innings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id uuid NOT NULL REFERENCES matches (id) ON DELETE CASCADE,
  batting_team_id uuid NOT NULL REFERENCES teams (id),
  bowling_team_id uuid NOT NULL REFERENCES teams (id),
  innings_number integer NOT NULL,
  total_runs integer NOT NULL DEFAULT 0,
  wickets integer NOT NULL DEFAULT 0,
  legal_balls integer NOT NULL DEFAULT 0,
  target_runs integer,
  status innings_status NOT NULL DEFAULT 'not_started',
  striker_id uuid REFERENCES players (id),
  non_striker_id uuid REFERENCES players (id),
  bowler_id uuid REFERENCES players (id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT innings_number_valid CHECK (innings_number IN (1, 2)),
  CONSTRAINT innings_different_teams CHECK (batting_team_id <> bowling_team_id),
  CONSTRAINT innings_non_negative CHECK (
    total_runs >= 0 AND wickets >= 0 AND legal_balls >= 0
  ),
  CONSTRAINT innings_match_number_unique UNIQUE (match_id, innings_number)
);

CREATE TABLE balls (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  innings_id uuid NOT NULL REFERENCES innings (id) ON DELETE CASCADE,
  sequence_no integer NOT NULL,
  over_number integer NOT NULL,
  ball_in_over integer NOT NULL,
  striker_id uuid REFERENCES players (id),
  non_striker_id uuid REFERENCES players (id),
  bowler_id uuid REFERENCES players (id),
  batsman_runs integer NOT NULL DEFAULT 0,
  extra_runs integer NOT NULL DEFAULT 0,
  total_runs integer NOT NULL DEFAULT 0,
  is_legal_delivery boolean NOT NULL DEFAULT true,
  extra_type extra_type,
  is_wicket boolean NOT NULL DEFAULT false,
  wicket_type wicket_type,
  dismissed_player_id uuid REFERENCES players (id),
  free_hit_next boolean NOT NULL DEFAULT false,
  commentary text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT balls_sequence_unique UNIQUE (innings_id, sequence_no),
  CONSTRAINT balls_non_negative CHECK (
    batsman_runs >= 0
    AND extra_runs >= 0
    AND total_runs >= 0
    AND sequence_no >= 1
    AND over_number >= 0
    AND ball_in_over BETWEEN 1 AND 6
  ),
  CONSTRAINT balls_wicket_consistency CHECK (
    (is_wicket = false AND wicket_type IS NULL)
    OR (is_wicket = true AND wicket_type IS NOT NULL)
  )
);

-- ---------------------------------------------------------------------------
-- Audit log
-- ---------------------------------------------------------------------------

CREATE TABLE audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id uuid REFERENCES users (id) ON DELETE SET NULL,
  action text NOT NULL,
  entity_type text NOT NULL,
  entity_id uuid,
  previous_value jsonb,
  new_value jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- updated_at trigger
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_users_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_app_settings_updated_at
  BEFORE UPDATE ON app_settings
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_tournaments_updated_at
  BEFORE UPDATE ON tournaments
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_teams_updated_at
  BEFORE UPDATE ON teams
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_players_updated_at
  BEFORE UPDATE ON players
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_matches_updated_at
  BEFORE UPDATE ON matches
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_innings_updated_at
  BEFORE UPDATE ON innings
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ---------------------------------------------------------------------------
-- Indexes
-- ---------------------------------------------------------------------------

CREATE INDEX idx_sessions_user_id ON sessions (user_id);
CREATE INDEX idx_sessions_expires_at ON sessions (expires_at);
CREATE INDEX idx_login_attempts_mobile_created
  ON login_attempts (mobile_number, created_at DESC);
CREATE INDEX idx_teams_tournament_id ON teams (tournament_id);
CREATE INDEX idx_teams_manager_id ON teams (manager_id);
CREATE INDEX idx_teams_registration_status ON teams (registration_status);
CREATE INDEX idx_players_team_id ON players (team_id);
CREATE INDEX idx_matches_tournament_id ON matches (tournament_id);
CREATE INDEX idx_matches_status ON matches (status);
CREATE INDEX idx_matches_scheduled_at ON matches (scheduled_at);
CREATE INDEX idx_match_scorers_user_id ON match_scorers (user_id);
CREATE INDEX idx_innings_match_id ON innings (match_id);
CREATE INDEX idx_balls_innings_id_sequence ON balls (innings_id, sequence_no DESC);
CREATE INDEX idx_balls_created_at ON balls (created_at DESC);
CREATE INDEX idx_audit_logs_created_at ON audit_logs (created_at DESC);
CREATE INDEX idx_audit_logs_entity ON audit_logs (entity_type, entity_id);

-- ---------------------------------------------------------------------------
-- Public-safe user view (never exposes pin_hash)
-- ---------------------------------------------------------------------------

CREATE VIEW public_users AS
SELECT
  id,
  name,
  mobile_number,
  role,
  is_active,
  created_at,
  updated_at,
  last_login_at
FROM users;

COMMENT ON VIEW public_users IS
  'Safe user projection without pin_hash. Prefer this for client-facing reads.';

-- ---------------------------------------------------------------------------
-- Helper: legal overs display from legal_balls
-- overs.balls where balls = legal_balls % 6
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION legal_balls_to_overs(p_legal_balls integer)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT (p_legal_balls / 6)::text || '.' || (p_legal_balls % 6)::text;
$$;
