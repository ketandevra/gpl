-- Super Overs are extra one-over innings after a tie (international T20).
ALTER TABLE innings
  DROP CONSTRAINT innings_number_valid;

ALTER TABLE innings
  ADD CONSTRAINT innings_number_valid CHECK (innings_number BETWEEN 1 AND 6);
