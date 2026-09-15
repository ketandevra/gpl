import "server-only";
import { adminRest, adminRpc, RestError } from "@/lib/supabase/rest";
import type { DangerScopeId } from "@/lib/admin/danger-scopes";

const SEED_ADMIN_ID = "11111111-1111-1111-1111-111111111101";
const ANY = "?id=not.is.null";
const WIPE_TIMEOUT_MS = 25_000;

function isMissingRpc(err: unknown): boolean {
  if (!(err instanceof RestError)) return false;
  if (err.status === 404) return true;
  const blob = `${err.message} ${JSON.stringify(err.details ?? "")}`;
  return /PGRST202|Could not find the function|schema cache/i.test(blob);
}

async function del(table: string, query = ANY): Promise<void> {
  try {
    await adminRest(table, {
      method: "DELETE",
      query,
      prefer: "return=minimal",
      timeoutMs: WIPE_TIMEOUT_MS,
    });
  } catch (err) {
    if (
      (table === "team_invites" || table === "team_owner_requests") &&
      err instanceof RestError &&
      (err.status === 404 || /does not exist|schema cache/i.test(err.message))
    ) {
      return;
    }
    throw err;
  }
}

async function patch(
  table: string,
  query: string,
  body: Record<string, unknown>,
): Promise<void> {
  await adminRest(table, {
    method: "PATCH",
    query,
    body,
    prefer: "return=minimal",
    timeoutMs: WIPE_TIMEOUT_MS,
  });
}

async function clearMatches(): Promise<void> {
  await del("balls");
  await del("innings");
  await del("match_scorers", "?match_id=not.is.null");
  await del("matches");
}

async function clearTeams(): Promise<void> {
  await patch("players", "?locked_team_id=not.is.null", {
    locked_team_id: null,
  });
  await del("team_invites");
  await del("team_owner_requests");
  await del("team_players");
  await del("teams");
}

async function clearPlayers(): Promise<void> {
  await patch("innings", ANY, {
    striker_id: null,
    non_striker_id: null,
    bowler_id: null,
  });
  await patch("balls", ANY, {
    striker_id: null,
    non_striker_id: null,
    bowler_id: null,
    dismissed_player_id: null,
  });
  await del("team_invites");
  await del("team_players");
  await del("players");
}

async function clearTournaments(): Promise<void> {
  await del("tournaments");
}

async function clearVerifications(keepIds: string[]): Promise<void> {
  await del("verification_documents");
  const keep = keepIds.map((id) => `id.neq.${id}`).join(",");
  await patch("users", keep ? `?and=(${keep})` : ANY, {
    aadhaar_number: null,
    verification_submitted_at: null,
    verification_reviewed_at: null,
    verification_reviewed_by: null,
    verification_rejection_reason: null,
    verification_status: "unverified",
  });
}

async function clearUsers(keepIds: string[]): Promise<void> {
  const keep = keepIds.map((id) => `id.neq.${id}`).join(",");
  const userKeep = keepIds.map((id) => `user_id.neq.${id}`).join(",");
  await patch("teams", "?manager_id=not.is.null", { manager_id: null });
  await patch("players", "?user_id=not.is.null", { user_id: null });
  if (userKeep) {
    await del("match_scorers", `?and=(${userKeep})`);
    await del("sessions", `?and=(${userKeep})`);
  }
  if (keep) {
    await del("verification_documents", `?and=(${keep.replaceAll("id.neq.", "user_id.neq.")})`);
    await del("users", `?and=(${keep})`);
  }
}

async function restoreSeedAdmin(): Promise<void> {
  await del("login_attempts");
  await del("sessions");
  await patch("users", `?id=eq.${SEED_ADMIN_ID}`, {
    name: "GPL Admin",
    mobile_number: "9636933097",
    role: "admin",
    is_active: true,
    verification_status: "verified",
    aadhaar_number: null,
    verification_submitted_at: null,
    verification_reviewed_at: null,
    verification_reviewed_by: null,
    verification_rejection_reason: null,
    failed_login_attempts: 0,
    locked_until: null,
  });
  await patch("app_settings", "?id=eq.1", {
    user_registration_open: false,
  });
}

async function clearDataScopeViaRest(
  scope: DangerScopeId,
  keepUserId: string | null,
): Promise<void> {
  const keepAdmin = [SEED_ADMIN_ID];
  const keepUsers =
    keepUserId && keepUserId !== SEED_ADMIN_ID
      ? [SEED_ADMIN_ID, keepUserId]
      : keepAdmin;

  if (scope === "matches" || scope === "teams" || scope === "tournaments" || scope === "all") {
    await clearMatches();
  }
  if (scope === "teams" || scope === "tournaments" || scope === "all") {
    await clearTeams();
  }
  if (scope === "players" || scope === "tournaments" || scope === "all") {
    await clearPlayers();
  }
  if (scope === "tournaments" || scope === "all") {
    await clearTournaments();
  }
  if (scope === "verifications") {
    await clearVerifications(keepUsers);
  }
  if (scope === "users" || scope === "all") {
    await clearUsers(scope === "all" ? keepAdmin : keepUsers);
  }
  if (scope === "all") {
    await restoreSeedAdmin();
  }
}

export async function clearDataScope(
  scope: DangerScopeId,
  keepUserId: string | null,
): Promise<void> {
  try {
    const result = await adminRpc<{ ok?: boolean; error?: string }>(
      "clear_data_scope",
      { p_scope: scope, p_keep_user_id: keepUserId },
      { timeoutMs: WIPE_TIMEOUT_MS },
    );
    if (result?.ok === true) return;
    throw new Error(result?.error || "Reset did not complete.");
  } catch (err) {
    if (!isMissingRpc(err)) throw err;
    await clearDataScopeViaRest(scope, keepUserId);
  }
}

export { SEED_ADMIN_ID };
