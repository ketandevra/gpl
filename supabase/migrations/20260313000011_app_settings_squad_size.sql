-- Configurable squad size (was hardcoded to 6 in the app)

ALTER TABLE app_settings
  ADD COLUMN IF NOT EXISTS squad_size integer NOT NULL DEFAULT 6;

ALTER TABLE app_settings
  DROP CONSTRAINT IF EXISTS app_settings_squad_size_range;

ALTER TABLE app_settings
  ADD CONSTRAINT app_settings_squad_size_range
  CHECK (squad_size >= 2 AND squad_size <= 15);

UPDATE app_settings
SET squad_size = 6
WHERE squad_size IS NULL;
