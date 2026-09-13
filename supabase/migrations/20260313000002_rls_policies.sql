-- Phase 1 RLS foundation
-- Strategy:
--   - Client uses anon key for public SELECTs only
--   - All authenticated writes go through Next.js server + service role
--   - RLS blocks direct client writes even if anon key is abused

ALTER TABLE app_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE login_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE tournaments ENABLE ROW LEVEL SECURITY;
ALTER TABLE teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE players ENABLE ROW LEVEL SECURITY;
ALTER TABLE matches ENABLE ROW LEVEL SECURITY;
ALTER TABLE match_scorers ENABLE ROW LEVEL SECURITY;
ALTER TABLE innings ENABLE ROW LEVEL SECURITY;
ALTER TABLE balls ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- Deny-by-default for sensitive tables (users, sessions, login_attempts, audit_logs, match_scorers).

CREATE POLICY app_settings_select_public
  ON app_settings
  FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY tournaments_select_public
  ON tournaments
  FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY teams_select_approved_public
  ON teams
  FOR SELECT
  TO anon, authenticated
  USING (approved = true AND registration_status = 'approved');

CREATE POLICY players_select_approved_public
  ON players
  FOR SELECT
  TO anon, authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM teams t
      WHERE t.id = players.team_id
        AND t.approved = true
        AND t.registration_status = 'approved'
    )
  );

CREATE POLICY matches_select_public
  ON matches
  FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY innings_select_public
  ON innings
  FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY balls_select_public
  ON balls
  FOR SELECT
  TO anon, authenticated
  USING (true);

-- No INSERT/UPDATE/DELETE policies for anon/authenticated.
-- Service role bypasses RLS for server-side mutations.

-- Enable Realtime for live scoring (safe if already added)
DO $$
BEGIN
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE matches;
  EXCEPTION
    WHEN duplicate_object THEN NULL;
    WHEN undefined_object THEN NULL;
  END;
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE innings;
  EXCEPTION
    WHEN duplicate_object THEN NULL;
    WHEN undefined_object THEN NULL;
  END;
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE balls;
  EXCEPTION
    WHEN duplicate_object THEN NULL;
    WHEN undefined_object THEN NULL;
  END;
END $$;
