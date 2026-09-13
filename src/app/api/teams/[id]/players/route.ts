import { NextResponse } from "next/server";
import { z } from "zod";
import { getSquadSize } from "@/lib/settings/app";
import { listPlayersByTeam } from "@/lib/teams/queries";
import {
  removeTeamPlayer,
  requireTeamManagerOrAdmin,
  setTeamRoster,
} from "@/lib/teams/service";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_request: Request, context: Ctx) {
  const { id } = await context.params;
  const auth = await requireTeamManagerOrAdmin(id);
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }
  const players = await listPlayersByTeam(id);
  return NextResponse.json({ players });
}

const addMemberSchema = z.object({
  player_id: z.string().uuid(),
  jersey_number: z.number().int().min(0).max(999).nullable().optional(),
});

const removeMemberSchema = z.object({
  player_id: z.string().uuid(),
});

/** Add one verified player to the team roster (captain or admin). */
export async function POST(request: Request, context: Ctx) {
  const { id } = await context.params;
  const auth = await requireTeamManagerOrAdmin(id);
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const parsed = addMemberSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input." },
      { status: 400 },
    );
  }

  const existing = await listPlayersByTeam(id);
  if (existing.some((p) => p.id === parsed.data.player_id)) {
    return NextResponse.json(
      { error: "This player is already added to this team." },
      { status: 400 },
    );
  }

  const squadSize = await getSquadSize();
  if (existing.length >= squadSize) {
    return NextResponse.json(
      {
        error: `Squad is full. A team can have at most ${squadSize} players.`,
      },
      { status: 400 },
    );
  }

  const members = [
    ...existing.map((p) => ({
      player_id: p.id,
      jersey_number: p.jersey_number,
    })),
    {
      player_id: parsed.data.player_id,
      jersey_number: parsed.data.jersey_number ?? null,
    },
  ];

  const result = await setTeamRoster(auth.user, id, { members });
  if ("error" in result) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }
  return NextResponse.json(result, { status: 201 });
}

/** Remove one player from the squad (captain or admin; pending teams). */
export async function DELETE(request: Request, context: Ctx) {
  const { id } = await context.params;
  const auth = await requireTeamManagerOrAdmin(id);
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const parsed = removeMemberSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input." },
      { status: 400 },
    );
  }

  const result = await removeTeamPlayer(auth.user, id, parsed.data.player_id);
  if ("error" in result) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }
  return NextResponse.json(result);
}
