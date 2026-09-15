-- UIDAI / Aadhaar Act: do not retain copies of Aadhaar after identity is
-- established. Drop leftover document metadata for already-verified users.
-- Image files in Storage bucket `aadhaar-docs` are removed by the app on
-- verify (and on the next admin verification page load).

DELETE FROM verification_documents vd
USING users u
WHERE vd.user_id = u.id
  AND u.verification_status = 'verified';
