import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { canAccessAdmin } from "@/lib/auth/permissions";
import {
  getActiveTournament,
  listApprovedTeams,
  getManagerName,
} from "@/lib/teams/queries";
import { requestTeamOwnership } from "@/lib/teams/owner-requests";
import { playerCreateTeamSchema } from "@/lib/validations/teams";
import { isSupabaseAdminConfigured } from "@/lib/supabase/env";

export async function GET() {
  if (!isSupabaseAdminConfigured()) {
    return NextResponse.json({ teams: [], registration_open: false });
  }

  const [teams, tournament] = await Promise.all([
    listApprovedTeams(),
    getActiveTournament(),
  ]);

  const withManagers = await Promise.all(
    teams.map(async (team) => {
      const name = await getManagerName(team.manager_id);
      return {
        ...team,
        manager_name: name,
        captain_name: name,
      };
    }),
  );

  return NextResponse.json({
    teams: withManagers,
    registration_open: Boolean(tournament?.registration_open),
    tournament: tournament
      ? { id: tournament.id, name: tournament.name }
      : null,
  });
}

/** Verified player requests to become a team owner. Team is created only after admin approval. */
export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Please sign in." }, { status: 401 });
  }
  if (canAccessAdmin(user)) {
    return NextResponse.json(
      {
        error: "Create teams from Admin → Teams (assign a captain there).",
      },
      { status: 400 },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const parsed = playerCreateTeamSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Enter a team name." },
      { status: 400 },
    );
  }

  const result = await requestTeamOwnership(user, parsed.data);
  if ("error" in result) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }
  return NextResponse.json({ request: result.request }, { status: 201 });
}
