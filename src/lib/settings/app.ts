import "server-only";
import {
  DEFAULT_SQUAD_SIZE,
  SQUAD_SIZE_MAX,
  SQUAD_SIZE_MIN,
} from "@/lib/constants";
import { adminRest, withRetry } from "@/lib/supabase/rest";
import { isSupabaseAdminConfigured } from "@/lib/supabase/env";

export function clampSquadSize(value: number): number {
  if (!Number.isFinite(value)) return DEFAULT_SQUAD_SIZE;
  return Math.min(SQUAD_SIZE_MAX, Math.max(SQUAD_SIZE_MIN, Math.round(value)));
}

/** Players allowed on one team. Falls back to 6 if settings are unavailable. */
export async function getSquadSize(): Promise<number> {
  if (!isSupabaseAdminConfigured()) return DEFAULT_SQUAD_SIZE;
  try {
    const rows = await withRetry(() =>
      adminRest<Array<{ squad_size: number | null }>>("app_settings", {
        query: "?id=eq.1&select=squad_size",
      }),
    );
    const n = rows[0]?.squad_size;
    if (typeof n === "number") return clampSquadSize(n);
  } catch {
    // Column may not exist until the migration is applied.
  }
  return DEFAULT_SQUAD_SIZE;
}
