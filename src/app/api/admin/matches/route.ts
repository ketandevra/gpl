import { NextResponse } from "next/server";
import { z } from "zod";
import { canAccessAdmin } from "@/lib/auth/permissions";
import { getCurrentUser } from "@/lib/auth/session";
import {
  applyMatchAction,
  createMatch,
  getMatchAdminDetail,
  updateMatch,
} from "@/lib/matches/service";
import { listMatches, listScorerUsers } from "@/lib/matches/queries";
import { listApprovedTeams } from "@/lib/teams/queries";
import {
  createMatchSchema,
  matchActionSchema,
  updateMatchSchema,
} from "@/lib/validations/matches";

async function requireAdmin() {
  const user = await getCurrentUser();
  if (!canAccessAdmin(user)) {
    return {
      error: NextResponse.json({ error: "Forbidden." }, { status: 403 }),
    };
  }
  return { user: user! };
}

export async function GET() {
  const auth = await requireAdmin();
  if ("error" in auth && auth.error) return auth.error;

  const [matches, teams, scorers] = await Promise.all([
    listMatches(),
    listApprovedTeams(),
    listScorerUsers(),
  ]);

  return NextResponse.json({ matches, teams, scorers });
}

export async function POST(request: Request) {
  const auth = await requireAdmin();
  if ("error" in auth && auth.error) return auth.error;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const parsed = createMatchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input." },
      { status: 400 },
    );
  }

  const result = await createMatch(auth.user, parsed.data);
  if ("error" in result) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }
  return NextResponse.json(result, { status: 201 });
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

  const withId = z.object({ match_id: z.string().uuid() }).safeParse(body);
  if (!withId.success) {
    return NextResponse.json({ error: "match_id is required." }, { status: 400 });
  }

  const actionParsed = matchActionSchema.safeParse(body);
  if (actionParsed.success) {
    const result = await applyMatchAction(
      auth.user,
      withId.data.match_id,
      actionParsed.data,
    );
    if ("error" in result) {
      return NextResponse.json(
        { error: result.error },
        { status: result.status },
      );
    }
    return NextResponse.json(result);
  }

  const updateParsed = updateMatchSchema.safeParse(body);
  if (!updateParsed.success) {
    return NextResponse.json(
      { error: updateParsed.error.issues[0]?.message ?? "Invalid input." },
      { status: 400 },
    );
  }

  const result = await updateMatch(
    auth.user,
    withId.data.match_id,
    updateParsed.data,
  );
  if ("error" in result) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }
  return NextResponse.json(result);
}

export async function PUT(request: Request) {
  // Detail fetch for editing
  const auth = await requireAdmin();
  if ("error" in auth && auth.error) return auth.error;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }
  const parsed = z.object({ match_id: z.string().uuid() }).safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "match_id is required." }, { status: 400 });
  }
  const detail = await getMatchAdminDetail(parsed.data.match_id);
  if (!detail) {
    return NextResponse.json({ error: "Match not found." }, { status: 404 });
  }
  return NextResponse.json(detail);
}
