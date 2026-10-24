import "server-only";
import { adminRest, withRetry } from "@/lib/supabase/rest";
import { isSupabaseAdminConfigured } from "@/lib/supabase/env";
import {
  AUTH_ACTIVITY_ACTIONS,
  type ActivityEvent,
  type ActivityUser,
  type AuthActivityAction,
} from "@/lib/admin/activity-types";

export type { ActivityEvent, ActivityUser, AuthActivityAction };
export { AUTH_ACTIVITY_ACTIONS };

type AuditRow = {
  id: string;
  actor_id: string | null;
  action: string;
  created_at: string;
};

export async function listAuthActivity(limit = 200): Promise<ActivityEvent[]> {
  if (!isSupabaseAdminConfigured()) return [];

  const rows = await withRetry(() =>
    adminRest<AuditRow[]>("audit_logs", {
      query: `?action=in.(${AUTH_ACTIVITY_ACTIONS.join(",")})&select=id,actor_id,action,created_at&order=created_at.desc&limit=${limit}`,
    }),
  );

  const ids = [...new Set(rows.map((row) => row.actor_id).filter(Boolean))] as string[];
  const users = ids.length
    ? await withRetry(() =>
        adminRest<
          Array<
            Omit<ActivityUser, "avatar_url" | "public_code"> & {
              avatar_url: string | null;
            }
          >
        >("users", {
          query: `?id=in.(${ids.join(",")})&select=id,name,mobile_number,role,avatar_url`,
        }),
      )
    : [];
  const players = ids.length
    ? await withRetry(() =>
        adminRest<
          Array<{
            user_id: string | null;
            name: string;
            public_code: string;
            photo_url: string | null;
          }>
        >("players", {
          query: `?user_id=in.(${ids.join(",")})&select=user_id,name,public_code,photo_url`,
        }),
      )
    : [];
  const playerByUser = new Map(
    players
      .filter((player) => player.user_id)
      .map((player) => [player.user_id!, player]),
  );
  const byId = new Map(
    users.map((user) => {
      const player = playerByUser.get(user.id);
      return [
        user.id,
        {
          ...user,
          name: player?.name ?? user.name,
          avatar_url: user.avatar_url ?? player?.photo_url ?? null,
          public_code: player?.public_code ?? null,
        } satisfies ActivityUser,
      ];
    }),
  );

  return rows
    .filter(
      (row): row is AuditRow & { action: AuthActivityAction } =>
        row.action === "auth.login" || row.action === "auth.logout",
    )
    .map((row) => ({
      id: row.id,
      action: row.action,
      created_at: row.created_at,
      user: row.actor_id ? byId.get(row.actor_id) ?? null : null,
    }));
}
