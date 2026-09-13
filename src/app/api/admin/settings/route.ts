import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth/session";
import { canAccessAdmin } from "@/lib/auth/permissions";
import { writeAuditLog } from "@/lib/auth/audit";
import { SQUAD_SIZE_MAX, SQUAD_SIZE_MIN } from "@/lib/constants";
import { clampSquadSize } from "@/lib/settings/app";
import { createAdminClient } from "@/lib/supabase/admin";
import { isSupabaseConfigured } from "@/lib/supabase/env";

const settingsSchema = z.object({
  user_registration_open: z.boolean().optional(),
  team_registration_open: z.boolean().optional(),
  tournament_id: z.string().uuid().optional(),
  squad_size: z
    .number()
    .int()
    .min(SQUAD_SIZE_MIN)
    .max(SQUAD_SIZE_MAX)
    .optional(),
});

async function requireAdmin() {
  const user = await getCurrentUser();
  if (!canAccessAdmin(user)) {
    return { error: NextResponse.json({ error: "Forbidden." }, { status: 403 }) };
  }
  if (!isSupabaseConfigured() || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return {
      error: NextResponse.json(
        { error: "Supabase is not configured." },
        { status: 503 },
      ),
    };
  }
  return { user: user! };
}

export async function GET() {
  const auth = await requireAdmin();
  if ("error" in auth && auth.error) return auth.error;

  const admin = createAdminClient();

  const [
    users,
    teams,
    players,
    matches,
    liveMatches,
    upcomingMatches,
    completedMatches,
    settings,
    activeTournament,
  ] = await Promise.all([
    admin.from("users").select("id", { count: "exact", head: true }),
    admin.from("teams").select("id", { count: "exact", head: true }),
    admin.from("players").select("id", { count: "exact", head: true }),
    admin.from("matches").select("id", { count: "exact", head: true }),
    admin
      .from("matches")
      .select("id", { count: "exact", head: true })
      .in("status", ["live", "innings_break"]),
    admin
      .from("matches")
      .select("id", { count: "exact", head: true })
      .eq("status", "scheduled"),
    admin
      .from("matches")
      .select("id", { count: "exact", head: true })
      .eq("status", "completed"),
    admin
      .from("app_settings")
      .select("*")
      .eq("id", 1)
      .maybeSingle(),
    admin
      .from("tournaments")
      .select("id, name, registration_open, status, is_active")
      .eq("is_active", true)
      .maybeSingle(),
  ]);

  return NextResponse.json({
    totals: {
      users: users.count ?? 0,
      teams: teams.count ?? 0,
      players: players.count ?? 0,
      matches: matches.count ?? 0,
      live: liveMatches.count ?? 0,
      upcoming: upcomingMatches.count ?? 0,
      completed: completedMatches.count ?? 0,
    },
    user_registration_open: Boolean(settings.data?.user_registration_open),
    squad_size: clampSquadSize(settings.data?.squad_size ?? 6),
    tournament: activeTournament.data ?? null,
  });
}

export async function PATCH(request: Request) {
  const auth = await requireAdmin();
  if ("error" in auth && auth.error) return auth.error;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const parsed = settingsSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input." },
      { status: 400 },
    );
  }

  const admin = createAdminClient();

  if (typeof parsed.data.user_registration_open === "boolean") {
    const { data: previous } = await admin
      .from("app_settings")
      .select("user_registration_open")
      .eq("id", 1)
      .maybeSingle();

    await admin
      .from("app_settings")
      .update({ user_registration_open: parsed.data.user_registration_open })
      .eq("id", 1);

    await writeAuditLog({
      actorId: auth.user.id,
      action: parsed.data.user_registration_open
        ? "settings.user_registration_opened"
        : "settings.user_registration_closed",
      entityType: "app_settings",
      entityId: null,
      previousValue: previous,
      newValue: {
        user_registration_open: parsed.data.user_registration_open,
      },
    });
  }

  if (typeof parsed.data.squad_size === "number") {
    const squad_size = clampSquadSize(parsed.data.squad_size);
    const { data: previous } = await admin
      .from("app_settings")
      .select("squad_size")
      .eq("id", 1)
      .maybeSingle();

    const { error } = await admin
      .from("app_settings")
      .update({ squad_size })
      .eq("id", 1);

    if (error) {
      return NextResponse.json(
        {
          error:
            "Could not save squad size. Apply the latest database migration and try again.",
        },
        { status: 500 },
      );
    }

    await writeAuditLog({
      actorId: auth.user.id,
      action: "settings.squad_size_updated",
      entityType: "app_settings",
      entityId: null,
      previousValue: previous,
      newValue: { squad_size },
    });

    return NextResponse.json({ ok: true, squad_size });
  }

  if (typeof parsed.data.team_registration_open === "boolean") {
    let tournamentId = parsed.data.tournament_id;
    if (!tournamentId) {
      const { data: active } = await admin
        .from("tournaments")
        .select("id")
        .eq("is_active", true)
        .maybeSingle();
      tournamentId = active?.id as string | undefined;
    }

    if (!tournamentId) {
      return NextResponse.json(
        { error: "No active tournament found." },
        { status: 400 },
      );
    }

    const { data: previous } = await admin
      .from("tournaments")
      .select("id, registration_open")
      .eq("id", tournamentId)
      .maybeSingle();

    await admin
      .from("tournaments")
      .update({ registration_open: parsed.data.team_registration_open })
      .eq("id", tournamentId);

    await writeAuditLog({
      actorId: auth.user.id,
      action: parsed.data.team_registration_open
        ? "tournament.team_registration_opened"
        : "tournament.team_registration_closed",
      entityType: "tournament",
      entityId: tournamentId,
      previousValue: previous,
      newValue: {
        registration_open: parsed.data.team_registration_open,
      },
    });
  }

  return NextResponse.json({ ok: true });
}
