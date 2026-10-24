import { adminRest, withRetry } from "@/lib/supabase/rest";
import { isSupabaseAdminConfigured } from "@/lib/supabase/env";
import {
  nextPublicCodeFrom,
  pickCanonicalPublicCode,
} from "@/lib/teams/public-code";
import type { PlayerRow } from "@/lib/teams/types";

async function activeTournamentId(): Promise<string | null> {
  const rows = await withRetry(() =>
    adminRest<Array<{ id: string }>>("tournaments", {
      query: "?is_active=eq.true&select=id&limit=1",
    }),
  );
  return rows[0]?.id ?? null;
}

async function listIdentityPlayers(input: {
  userId?: string | null;
  mobile_number?: string | null;
}): Promise<PlayerRow[]> {
  if (!isSupabaseAdminConfigured()) return [];
  if (input.userId) {
    return withRetry(() =>
      adminRest<PlayerRow[]>("players", {
        query: `?user_id=eq.${encodeURIComponent(input.userId)}&select=*&order=created_at.asc`,
      }),
    );
  }
  if (input.mobile_number) {
    return withRetry(() =>
      adminRest<PlayerRow[]>("players", {
        query: `?mobile_number=eq.${encodeURIComponent(input.mobile_number)}&select=*&order=created_at.asc`,
      }),
    );
  }
  return [];
}

async function nextUnusedPublicCode(): Promise<string> {
  const codes = await withRetry(() =>
    adminRest<Array<{ public_code: string }>>("players", {
      query: "?select=public_code&limit=500",
    }),
  );
  return nextPublicCodeFrom(codes.map((row) => row.public_code));
}

/** Same person keeps one Player ID across every tournament. */
export async function publicCodeForIdentity(input: {
  userId?: string | null;
  mobile_number?: string | null;
}): Promise<string> {
  const rows = await listIdentityPlayers(input);
  return (
    pickCanonicalPublicCode(rows, await activeTournamentId()) ??
    (await nextUnusedPublicCode())
  );
}

/**
 * One player row per user per tournament. Reuses the same user and the
 * same public Player ID so career stats stay linked across editions.
 */
export async function ensurePlayerInTournament(
  userId: string,
  tournamentId: string,
): Promise<PlayerRow | null> {
  if (!isSupabaseAdminConfigured()) return null;

  const existing = await withRetry(() =>
    adminRest<PlayerRow[]>("players", {
      query: `?tournament_id=eq.${encodeURIComponent(tournamentId)}&user_id=eq.${encodeURIComponent(userId)}&select=*&limit=1`,
    }),
  );
  const public_code = await publicCodeForIdentity({ userId });
  if (existing[0]) {
    if (existing[0].public_code !== public_code) {
      const updated = await withRetry(() =>
        adminRest<PlayerRow[]>("players", {
          method: "PATCH",
          query: `?id=eq.${encodeURIComponent(existing[0].id)}`,
          prefer: "return=representation",
          body: { public_code },
        }),
      );
      return updated[0] ?? { ...existing[0], public_code };
    }
    return existing[0];
  }

  const users = await withRetry(() =>
    adminRest<
      Array<{
        id: string;
        name: string;
        mobile_number: string;
        verification_status: string;
        preferred_player_role: string | null;
        tshirt_size: string | null;
      }>
    >("users", {
      query: `?id=eq.${encodeURIComponent(userId)}&select=id,name,mobile_number,verification_status,preferred_player_role,tshirt_size&limit=1`,
    }),
  );
  const user = users[0];
  if (!user || user.verification_status !== "verified") return null;

  const prior = await listIdentityPlayers({ userId });
  const template = prior[0];

  const created = await withRetry(() =>
    adminRest<PlayerRow[]>("players", {
      method: "POST",
      prefer: "return=representation",
      body: [
        {
          tournament_id: tournamentId,
          public_code,
          name: template?.name ?? user.name,
          mobile_number: template?.mobile_number ?? user.mobile_number,
          user_id: userId,
          role: template?.role ?? user.preferred_player_role ?? "batsman",
          tshirt_size: template?.tshirt_size ?? user.tshirt_size,
          batting_style: template?.batting_style ?? null,
          bowling_style: template?.bowling_style ?? null,
          photo_url: template?.photo_url ?? null,
          locked_team_id: null,
        },
      ],
    }),
  );
  return created[0] ?? null;
}
