import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { canAccessAdmin } from "@/lib/auth/permissions";
import { createTournamentPlayer } from "@/lib/teams/service";
import {
  getActiveTournament,
  searchVerifiedPlayersForPicker,
} from "@/lib/teams/queries";
import { createTournamentPlayerSchema } from "@/lib/validations/teams";
import { isSupabaseAdminConfigured } from "@/lib/supabase/env";
import { adminRest, withRetry } from "@/lib/supabase/rest";
import { ensureTournamentPlayerForUser } from "@/lib/verification/service";

export async function GET(request: Request) {
  if (!isSupabaseAdminConfigured()) {
    return NextResponse.json({ players: [] });
  }

  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Please sign in." }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const excludeTeamId = searchParams.get("exclude_team_id") ?? undefined;
  const q = (searchParams.get("q") ?? "").trim();

  const tournament = await getActiveTournament();
  if (!tournament) {
    return NextResponse.json({ players: [], tournament: null });
  }

  // Ensure tournament player rows exist for matching verified users (server-only).
  type VerifiedUser = { id: string };
  let verifiedUsers: VerifiedUser[] = [];
  if (q) {
    const encoded = encodeURIComponent(`*${q}*`);
    verifiedUsers = await withRetry(() =>
      adminRest<VerifiedUser[]>("users", {
        query: `?verification_status=eq.verified&is_active=eq.true&role=neq.admin&or=(name.ilike.${encoded},mobile_number.ilike.${encoded})&select=id&limit=40`,
      }),
    );
  } else {
    verifiedUsers = await withRetry(() =>
      adminRest<VerifiedUser[]>("users", {
        query:
          "?verification_status=eq.verified&is_active=eq.true&role=neq.admin&select=id&order=name.asc&limit=40",
      }),
    );
  }
  for (const u of verifiedUsers) {
    await ensureTournamentPlayerForUser(u.id);
  }

  const players = await searchVerifiedPlayersForPicker(tournament.id, {
    excludeTeamId,
    q,
    limit: 40,
  });

  return NextResponse.json({
    tournament: { id: tournament.id, name: tournament.name },
    players,
  });
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!canAccessAdmin(user)) {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const parsed = createTournamentPlayerSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input." },
      { status: 400 },
    );
  }

  const result = await createTournamentPlayer(user!, parsed.data);
  if ("error" in result) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }
  return NextResponse.json(result, { status: 201 });
}
