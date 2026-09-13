-- Player registration preferences (role + t-shirt size)

DO $$ BEGIN
  CREATE TYPE tshirt_size AS ENUM (
    'XS', 'S', 'M', 'L', 'XL', 'XXL', 'XXXL'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS preferred_player_role player_role,
  ADD COLUMN IF NOT EXISTS tshirt_size tshirt_size;

ALTER TABLE players
  ADD COLUMN IF NOT EXISTS tshirt_size tshirt_size;

COMMENT ON COLUMN users.preferred_player_role IS
  'Playing role chosen during Register as player';
COMMENT ON COLUMN users.tshirt_size IS
  'Jersey / t-shirt size chosen during Register as player';
COMMENT ON COLUMN players.tshirt_size IS
  'Copied from user preference when tournament player row is created';
