import { NextResponse } from "next/server";
import { canAccessAdmin } from "@/lib/auth/permissions";
import { getCurrentUser } from "@/lib/auth/session";
import { writeAuditLog } from "@/lib/auth/audit";
import { adminRest, withRetry } from "@/lib/supabase/rest";
import {
  getManagerName,
  getTeamById,
  listPlayersByTeam,
} from "@/lib/teams/queries";
import { canManageTeam } from "@/lib/teams/service";
import { updateTeamSchema } from "@/lib/validations/teams";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_request: Request, context: Ctx) {
  const { id } = await context.params;
  const team = await getTeamById(id);
  if (!team) {
    return NextResponse.json({ error: "Team not found." }, { status: 404 });
  }

  const user = await getCurrentUser();
  const canViewPrivate =
    canAccessAdmin(user) || (user && team.manager_id === user.id);

  if (!team.approved && !canViewPrivate) {
    const manager_name = await getManagerName(team.manager_id);
    return NextResponse.json({ team, players: [], manager_name });
  }

  const [players, manager_name] = await Promise.all([
    listPlayersByTeam(id),
    getManagerName(team.manager_id),
  ]);

  return NextResponse.json({ team, players, manager_name });
}

export async function PATCH(request: Request, context: Ctx) {
  const { id } = await context.params;
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Please sign in." }, { status: 401 });
  }

  const team = await getTeamById(id);
  if (!team) {
    return NextResponse.json({ error: "Team not found." }, { status: 404 });
  }
  if (!canManageTeam(user, team)) {
    return NextResponse.json(
      { error: "You can only manage your own team." },
      { status: 403 },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const parsed = updateTeamSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input." },
      { status: 400 },
    );
  }

  const updated = await withRetry(() =>
    adminRest<typeof team[]>("teams", {
      method: "PATCH",
      query: `?id=eq.${encodeURIComponent(id)}`,
      prefer: "return=representation",
      body: parsed.data,
    }),
  );

  await writeAuditLog({
    actorId: user.id,
    action: "team.update",
    entityType: "team",
    entityId: id,
    previousValue: { name: team.name, short_name: team.short_name },
    newValue: parsed.data,
  });

  return NextResponse.json({ team: updated[0] ?? team });
}
