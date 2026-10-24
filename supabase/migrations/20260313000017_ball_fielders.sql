-- Credit fielders on dismissals (catches, stumpings, run-outs).
ALTER TABLE balls
  ADD COLUMN IF NOT EXISTS fielder_id uuid REFERENCES players (id),
  ADD COLUMN IF NOT EXISTS assist_fielder_id uuid REFERENCES players (id),
  ADD COLUMN IF NOT EXISTS is_caught_behind boolean NOT NULL DEFAULT false;
