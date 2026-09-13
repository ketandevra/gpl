import { NextResponse } from "next/server";
import { z } from "zod";
import { canAccessAdmin } from "@/lib/auth/permissions";
import { getCurrentUser } from "@/lib/auth/session";
import {
  approveTeam,
  createTeamByAdmin,
  rejectTeam,
  setTeamRoster,
} from "@/lib/teams/service";
import {
  getManagerName,
  listAllTeams,
  listPlayersByTeam,
} from "@/lib/teams/queries";
import {
  adminCreateTeamSchema,
  setTeamRosterSchema,
  teamDecisionSchema,
} from "@/lib/validations/teams";

const adminDecisionSchema = teamDecisionSchema.extend({
  team_id: z.string().uuid(),
});

const adminRosterSchema = setTeamRosterSchema.extend({
  team_id: z.string().uuid(),
  action: z.literal("set_roster").optional(),
});

export async function GET() {
  const user = await getCurrentUser();
  if (!canAccessAdmin(user)) {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  }

  const teams = await listAllTeams();
  const enriched = await Promise.all(
    teams.map(async (team) => {
      const [manager_name, players] = await Promise.all([
        getManagerName(team.manager_id),
        listPlayersByTeam(team.id),
      ]);
      return {
        ...team,
        manager_name,
        captain_name: manager_name,
        player_count: players.length,
        players,
      };
    }),
  );

  return NextResponse.json({ teams: enriched });
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

  const parsed = adminCreateTeamSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input." },
      { status: 400 },
    );
  }

  const result = await createTeamByAdmin(user!, parsed.data);
  if ("error" in result) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  const captain_name = await getManagerName(result.team.manager_id);
  return NextResponse.json(
    { team: result.team, captain_name },
    { status: 201 },
  );
}

export async function PATCH(request: Request) {
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

  if (
    typeof body === "object" &&
    body &&
    "members" in body &&
    "team_id" in body
  ) {
    const parsed = adminRosterSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Invalid input." },
        { status: 400 },
      );
    }
    const result = await setTeamRoster(user!, parsed.data.team_id, {
      members: parsed.data.members,
    });
    if ("error" in result) {
      return NextResponse.json(
        { error: result.error },
        { status: result.status },
      );
    }
    return NextResponse.json(result);
  }

  const parsed = adminDecisionSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input." },
      { status: 400 },
    );
  }

  if (parsed.data.decision === "approve") {
    const result = await approveTeam(user!, parsed.data.team_id);
    if ("error" in result) {
      return NextResponse.json(
        { error: result.error },
        { status: result.status },
      );
    }
    return NextResponse.json(result);
  }

  const result = await rejectTeam(user!, parsed.data.team_id);
  if ("error" in result) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }
  return NextResponse.json(result);
}
