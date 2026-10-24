import { adminRest, withRetry } from "@/lib/supabase/rest";
import { isSupabaseAdminConfigured } from "@/lib/supabase/env";
import type { PublicTournament } from "@/lib/tournaments/labels";

export type { PublicTournament } from "@/lib/tournaments/labels";
export {
  formatTournamentDates,
  tournamentStatusLabel,
} from "@/lib/tournaments/labels";

export async function getTournamentById(
  id: string,
): Promise<PublicTournament | null> {
  if (!isSupabaseAdminConfigured()) return null;
  const rows = await withRetry(() =>
    adminRest<PublicTournament[]>("tournaments", {
      query: `?id=eq.${encodeURIComponent(id)}&select=id,name,short_name,location,start_date,end_date,status,registration_open,is_active,created_at&limit=1`,
    }),
  );
  return rows[0] ?? null;
}

export async function listAllTournaments(): Promise<PublicTournament[]> {
  if (!isSupabaseAdminConfigured()) return [];
  return withRetry(() =>
    adminRest<PublicTournament[]>("tournaments", {
      query:
        "?select=id,name,short_name,location,start_date,end_date,status,registration_open,is_active,created_at&order=is_active.desc,start_date.desc.nullslast",
    }),
  );
}

/** Ongoing and upcoming tournaments for the public home screen. */
export async function listPublicTournaments(): Promise<PublicTournament[]> {
  if (!isSupabaseAdminConfigured()) return [];
  return withRetry(() =>
    adminRest<PublicTournament[]>("tournaments", {
      query:
        "?status=in.(ongoing,upcoming)&select=id,name,short_name,location,start_date,end_date,status,registration_open,is_active&order=is_active.desc,start_date.asc.nullslast",
    }),
  );
}
