-- Storage buckets for team logos and player photos
-- Public read; uploads will be mediated by the Next.js server in later phases.

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES
  (
    'team-logos',
    'team-logos',
    true,
    2097152,
    ARRAY['image/jpeg', 'image/png', 'image/webp']
  ),
  (
    'player-photos',
    'player-photos',
    true,
    2097152,
    ARRAY['image/jpeg', 'image/png', 'image/webp']
  )
ON CONFLICT (id) DO NOTHING;

-- Public read for both buckets
CREATE POLICY team_logos_public_read
  ON storage.objects
  FOR SELECT
  TO anon, authenticated
  USING (bucket_id = 'team-logos');

CREATE POLICY player_photos_public_read
  ON storage.objects
  FOR SELECT
  TO anon, authenticated
  USING (bucket_id = 'player-photos');

-- No public INSERT/UPDATE/DELETE — uploads via service role only in Phase 3+.
