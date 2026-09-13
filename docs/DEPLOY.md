# Deploy

GPL is a Next.js App Router app with Supabase. **Vercel** is the simplest host.

## Prerequisites

1. Apply **all** files in `supabase/migrations/` in filename order (`00001` … `00012`). Latest required for production:
   - `00011` — `app_settings.squad_size`
   - `00012` — Danger zone `clear_data_scope`
2. **Do not** run `supabase/seed.sql` on production. Create a real admin user, or keep the seed admin and **change the PIN**.
3. Environment (see `.env.example`):
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY` (server only)
   - Optional: `SESSION_COOKIE_NAME`, `SESSION_TTL_DAYS`, `NEXT_PUBLIC_APP_NAME`

## Vercel

```bash
npm i -g vercel
vercel
```

Add the env vars for **Production** and **Preview**. Build: `npm run build`.

## Cloudflare Pages (OpenNext)

```bash
npm install -D @opennextjs/cloudflare wrangler
npx opennextjs-cloudflare build
npx wrangler pages deploy
```

Set the same secrets. Do not prefix the service role key with `NEXT_PUBLIC_`.

## Supabase checklist

- [ ] All migrations through `00012` applied
- [ ] RLS on; writes only via the Next.js service role
- [ ] Realtime for `matches`, `innings`, `balls`
- [ ] Storage: `aadhaar-docs` (private), `user-avatars`, `team-logos`, `player-photos`
- [ ] User registration closed until you open it
- [ ] Admin PIN changed from any documented/dev value

## Smoke test

1. `/` and `/api/health` load
2. Register (if open) → `/verify` → admin approves
3. Profile shows **ID Card** only when verified
4. Admin creates a team + captain; captain fills the squad
5. Admin creates a match, assigns a scorer, records a ball
6. `/matches/[id]` updates live
7. `/stats` after a completed match
8. On a **copy** of the database, try one Danger zone scoped wipe (not on live data first)
