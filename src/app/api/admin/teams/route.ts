import { NextResponse } from "next/server";
import { z } from "zod";
import { canAccessAdmin } from "@/lib/auth/permissions";
import { getCurrentUser } from "@/lib/auth/session";
import {
  approveTeam,
  createTeamByAdmin,
  deleteTeamByAdmin,
  rejectTeam,
  setTeamRoster,
  updateTeamByAdmin,
} from "@/lib/teams/service";
import {
  decideOwnerRequest,
  listPendingOwnerRequests,
} from "@/lib/teams/owner-requests";
import {
  getActiveTournament,
  getManagerName,
  listAllTeams,
  listPlayersByTeam,
} from "@/lib/teams/queries";
import {
  adminCreateTeamSchema,
  adminDeleteTeamSchema,
  adminUpdateTeamSchema,
  ownerRequestDecisionSchema,
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

  const [teams, tournament] = await Promise.all([
    listAllTeams(),
    getActiveTournament(),
  ]);
  const [enriched, owner_requests] = await Promise.all([
    Promise.all(
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
    ),
    listPendingOwnerRequests(tournament?.id),
  ]);

  return NextResponse.json({ teams: enriched, owner_requests });
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
    "action" in body &&
    (body as { action?: string }).action === "owner_request"
  ) {
    const parsed = ownerRequestDecisionSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Invalid input." },
        { status: 400 },
      );
    }
    const result = await decideOwnerRequest(user!, {
      requestId: parsed.data.request_id,
      decision: parsed.data.decision,
      rejection_reason: parsed.data.rejection_reason,
    });
    if ("error" in result) {
      return NextResponse.json(
        { error: result.error },
        { status: result.status },
      );
    }
    const captain_name = result.team
      ? await getManagerName(result.team.manager_id)
      : null;
    return NextResponse.json({ ...result, captain_name });
  }

  if (
    typeof body === "object" &&
    body &&
    "action" in body &&
    (body as { action?: string }).action === "delete"
  ) {
    const parsed = adminDeleteTeamSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Invalid input." },
        { status: 400 },
      );
    }
    const result = await deleteTeamByAdmin(user!, parsed.data.team_id);
    if ("error" in result) {
      return NextResponse.json(
        { error: result.error },
        { status: result.status },
      );
    }
    return NextResponse.json(result);
  }

  if (
    typeof body === "object" &&
    body &&
    "action" in body &&
    (body as { action?: string }).action === "update"
  ) {
    const parsed = adminUpdateTeamSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Invalid input." },
        { status: 400 },
      );
    }
    const result = await updateTeamByAdmin(user!, {
      teamId: parsed.data.team_id,
      name: parsed.data.name,
      short_name: parsed.data.short_name,
      captain_id: parsed.data.captain_id,
    });
    if ("error" in result) {
      return NextResponse.json(
        { error: result.error },
        { status: result.status },
      );
    }
    return NextResponse.json(result);
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
