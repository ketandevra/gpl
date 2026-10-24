-- Knockout round labels and extra match statuses.
-- New enum values cannot be used in the same transaction, so tables
-- that reference them live in the following migration.

ALTER TYPE match_type ADD VALUE IF NOT EXISTS 'quarter';
ALTER TYPE match_type ADD VALUE IF NOT EXISTS 'last16';
ALTER TYPE match_type ADD VALUE IF NOT EXISTS 'prelim';

ALTER TYPE match_status ADD VALUE IF NOT EXISTS 'postponed';
ALTER TYPE match_status ADD VALUE IF NOT EXISTS 'cancelled';
