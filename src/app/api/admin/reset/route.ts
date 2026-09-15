import { NextResponse } from "next/server";
import { z } from "zod";
import {
  DANGER_SCOPES,
  type DangerScopeId,
} from "@/lib/admin/danger-scopes";
import { writeAuditLog } from "@/lib/auth/audit";
import { canAccessAdmin } from "@/lib/auth/permissions";
import { getCurrentUser } from "@/lib/auth/session";
import { clearDataScope, SEED_ADMIN_ID } from "@/lib/admin/clear-data";
import { createAdminClient } from "@/lib/supabase/admin";
import { RestError } from "@/lib/supabase/rest";
import { isSupabaseConfigured } from "@/lib/supabase/env";

const SCOPES = DANGER_SCOPES.map((s) => s.id) as [DangerScopeId, ...DangerScopeId[]];

const bodySchema = z.object({
  scope: z.enum(SCOPES).default("all"),
  confirmation: z.string().trim(),
});

async function emptyStorageBucket(bucket: string, keepPrefixes: string[] = []) {
  const keep = new Set(keepPrefixes.filter(Boolean));
  try {
    const admin = createAdminClient();
    const store = admin.storage.from(bucket);
    const { data: root } = await store.list("", { limit: 1000 });
    if (!root?.length) return;

    const filesToRemove: string[] = [];
    for (const entry of root) {
      if (!entry.name || keep.has(entry.name)) continue;
      if (entry.id) {
        filesToRemove.push(entry.name);
        continue;
      }
      const { data: files } = await store.list(entry.name, { limit: 200 });
      if (files?.length) {
        filesToRemove.push(...files.map((f) => `${entry.name}/${f.name}`));
      }
    }
    if (filesToRemove.length) await store.remove(filesToRemove);
  } catch (err) {
    console.error(`[reset] storage cleanup skipped (${bucket}):`, err);
  }
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!canAccessAdmin(user) || !user) {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  }
  if (!isSupabaseConfigured() || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json(
      { error: "Supabase is not configured." },
      { status: 503 },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Confirmation required." }, { status: 400 });
  }

  const scope = parsed.data.scope;
  const spec = DANGER_SCOPES.find((s) => s.id === scope);
  if (!spec || parsed.data.confirmation !== spec.confirm) {
    return NextResponse.json(
      {
        error: `Type ${spec?.confirm ?? "the confirmation phrase"} exactly to confirm.`,
      },
      { status: 400 },
    );
  }

  try {
    await clearDataScope(scope, scope === "all" ? null : user.id);
  } catch (err) {
    console.error("[reset] clear failed:", err);
    const detail =
      err instanceof RestError && err.status === 504
        ? "Delete timed out. Close any live scoring session and try again."
        : err instanceof RestError
          ? err.message
          : err instanceof Error
            ? err.message
            : "Reset failed.";
    return NextResponse.json({ error: detail }, { status: 500 });
  }

  const keepUserFolders = [user.id, SEED_ADMIN_ID];
  if (scope === "verifications" || scope === "all") {
    await emptyStorageBucket("aadhaar-docs");
  } else if (scope === "users") {
    await emptyStorageBucket("aadhaar-docs", keepUserFolders);
    await emptyStorageBucket("user-avatars", keepUserFolders);
  }
  if (scope === "all") {
    await emptyStorageBucket("user-avatars");
  }
  if (scope === "teams" || scope === "tournaments" || scope === "all") {
    await emptyStorageBucket("team-logos");
  }
  if (scope === "players" || scope === "tournaments" || scope === "all") {
    await emptyStorageBucket("player-photos");
  }

  await writeAuditLog({
    actorId: scope === "all" ? SEED_ADMIN_ID : user.id,
    action: `settings.data_cleared_${scope}`,
    entityType: "app_settings",
    newValue: { scope, by: user.id },
  });

  const messages: Record<DangerScopeId, string> = {
    users: "All users removed except GPL Admin (and your account).",
    teams: "All teams and their matches were removed.",
    players: "All players were removed from the registry and squads.",
    matches: "All matches and scoring data were removed.",
    tournaments: "All tournaments, teams, players, and matches were removed.",
    verifications: "All verification documents were removed.",
    all: "All data cleared. Only GPL Admin remains. Sign in again with the admin mobile/PIN.",
  };

  return NextResponse.json({
    ok: true,
    scope,
    sign_out: scope === "all",
    message: messages[scope],
  });
}
