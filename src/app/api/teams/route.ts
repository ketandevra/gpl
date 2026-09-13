import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { canAccessAdmin } from "@/lib/auth/permissions";
import {
  getActiveTournament,
  listApprovedTeams,
  getManagerName,
} from "@/lib/teams/queries";
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

/** Public team create removed — only admins create teams. */
export async function POST() {
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
  return NextResponse.json(
    {
      error:
        "Only an admin can create a team. Ask the admin to create your team and assign you as captain.",
    },
    { status: 403 },
  );
}
