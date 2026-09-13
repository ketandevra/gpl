-- Tighten storage limits now that server compresses uploads to JPEG
-- Avatars target ≤120KB; Aadhaar docs target ≤280KB. Allow headroom.

UPDATE storage.buckets
SET
  file_size_limit = 153600, -- 150 KB
  allowed_mime_types = ARRAY['image/jpeg']
WHERE id = 'user-avatars';

UPDATE storage.buckets
SET
  file_size_limit = 307200, -- 300 KB
  allowed_mime_types = ARRAY['image/jpeg']
WHERE id = 'aadhaar-docs';
