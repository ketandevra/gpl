# Ghanchi Premier League (GPL)

Mobile-first cricket tournament app: registration, verification, teams, live scoring, and stats.

## Stack

- **Frontend:** Next.js (App Router) + TypeScript + Tailwind CSS
- **Backend:** Supabase (PostgreSQL, Realtime, Storage)
- **Auth:** Mobile number + 4-digit PIN (custom sessions; no SMS/OTP)

## Local setup

```bash
npm install
cp .env.example .env.local
```

Fill Supabase values from **Settings → API**. Then apply every file in `supabase/migrations/` **in filename order** in the [SQL Editor](https://supabase.com/dashboard) (or `npx supabase db push`).

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). Health: `/api/health`.

`supabase/seed.sql` is **development only**. Do not run it on production.

## Production

See [docs/DEPLOY.md](docs/DEPLOY.md).

1. Apply all migrations through `20260313000012_clear_data_scope.sql` (squad size + Danger zone).
2. Create or keep one admin account. Change the default admin PIN.
3. Leave user registration closed until you want signups (`app_settings.user_registration_open`).
4. Set `SUPABASE_SERVICE_ROLE_KEY` on the host only — never `NEXT_PUBLIC_`.

```bash
npm test
npm run build
```

## How the app works

- **Users** register with mobile + PIN when the admin opens registration.
- **Players** submit Aadhaar on `/verify`. Admins approve on `/admin/verifications`. The ID card appears on Profile only after verified.
- **Teams** are created by admins and assigned a captain. Captains add verified players up to the squad size in **Admin → Settings**.
- **Matches** are created in admin; assigned scorers (or admins) score at `/score/[matchId]`.
- **Public** pages: matches, live, teams, players, stats. Mobiles and Aadhaar are not shown publicly.
- **Danger zone** on the admin dashboard can wipe users, teams, players, matches, tournaments, or verifications separately.

## Environment

See `.env.example`.

- `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` — browser + server
- `SUPABASE_SERVICE_ROLE_KEY` — **server only**
