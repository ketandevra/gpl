# Architecture decisions — Ghanchi Premier League (GPL)

Historical notes. Current setup and deploy steps are in the root `README.md` and `docs/DEPLOY.md`.

## Phase 2 — Authentication
- Mobile + 4-digit PIN; bcrypt cost 12
- Session cookie HTTP-only; DB stores SHA-256(token)
- 5 failures → 15 min lockout; IP failure cap 20/hour
- Registration gated by `app_settings.user_registration_open`
- Admin routes require `role = admin` (middleware cookie check + server role check)
- Service role used only in Route Handlers / Server Components — never client


## Writes
Application mutations use the Supabase **service role** on the Next.js server.
RLS allows public/anon **SELECT** on tournament data only; no client write policies.

## Registration toggles
- User registration: `app_settings.user_registration_open`
- Team registration: `tournaments.registration_open` (per tournament)

## Teams
Belong to a tournament (`tournament_id`). Require admin approval before public visibility.

## Player membership (tournament lock)
- `players` is a **tournament player pool** (`tournament_id`, `public_code` e.g. P001).
- `team_players` is membership (pending teams may share players).
- `players.locked_team_id` is set only when a team is **approved**.
- Approval runs via `approve_team()` RPC with `FOR UPDATE` row locks — race-safe exclusivity per tournament.
- Editing an approved roster uses `set_team_roster()` with the same conflict checks.

## User identity verification (Aadhaar)
- `users.verification_status`: `unverified` → `pending` → `verified` / `rejected`
- Aadhaar front/back images in private Storage bucket `aadhaar-docs`; admin-only signed URLs
- `users.aadhaar_number` UNIQUE (partial index); never exposed on public pages/APIs
- `players.user_id` links tournament player to verified user identity
- Team player picker searches **verified users only** (server-side)
- `approve_team` / `set_team_roster` reject unverified or unlinked players
- Revoking verification does **not** remove approved team membership or match history
- Audit logs record verification actions without storing Aadhaar values or document URLs

## Scorers
Assigned per match via `match_scorers`. Admins may always score (enforced in app logic from Phase 5).

## Hosting
Prefer Cloudflare Pages + OpenNext. Fall back to Vercel Hobby if OpenNext blocks required Next.js features.

## Active tournament
Partial unique index ensures at most one `tournaments.is_active = true` for homepage focus.
