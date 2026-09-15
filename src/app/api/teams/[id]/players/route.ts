import { NextResponse } from "next/server";
import { z } from "zod";
import { listPlayersByTeam } from "@/lib/teams/queries";
import {
  cancelTeamInvite,
  invitePlayerToTeam,
  listPendingInvitesForTeam,
} from "@/lib/teams/invites";
import {
  removeTeamPlayer,
  requireTeamManagerOrAdmin,
} from "@/lib/teams/service";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_request: Request, context: Ctx) {
  const { id } = await context.params;
  const auth = await requireTeamManagerOrAdmin(id);
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }
  const [players, invites] = await Promise.all([
    listPlayersByTeam(id),
    listPendingInvitesForTeam(id),
  ]);
  return NextResponse.json({ players, invites });
}

const addMemberSchema = z.object({
  player_id: z.string().uuid(),
  jersey_number: z.number().int().min(0).max(999).nullable().optional(),
});

const removeMemberSchema = z.object({
  player_id: z.string().uuid().optional(),
  invite_id: z.string().uuid().optional(),
});

/** Invite one verified player. They join the roster only after accepting. */
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

  const result = await invitePlayerToTeam(
    auth.user,
    id,
    parsed.data.player_id,
    parsed.data.jersey_number ?? null,
  );
  if ("error" in result) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }
  return NextResponse.json(result, { status: 201 });
}

/** Remove a squad member or withdraw a pending invite. */
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

  if (parsed.data.invite_id) {
    const cancelled = await cancelTeamInvite(
      auth.user,
      id,
      parsed.data.invite_id,
    );
    if ("error" in cancelled) {
      return NextResponse.json(
        { error: cancelled.error },
        { status: cancelled.status },
      );
    }
    return NextResponse.json(cancelled);
  }

  if (!parsed.data.player_id) {
    return NextResponse.json(
      { error: "player_id or invite_id is required." },
      { status: 400 },
    );
  }

  const result = await removeTeamPlayer(auth.user, id, parsed.data.player_id);
  if ("error" in result) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }
  const invites = await listPendingInvitesForTeam(id);
  return NextResponse.json({ ...result, invites });
}
