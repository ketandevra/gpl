import { NextResponse } from "next/server";
import { canAccessAdmin } from "@/lib/auth/permissions";
import { getCurrentUser } from "@/lib/auth/session";
import { FixtureError } from "@/lib/fixtures/draw";
import {
  completeLeague,
  confirmDraw,
  confirmKnockout,
  confirmLeague,
  drawTeam,
  getFixtureWorkspace,
  previewKnockout,
  previewLeague,
  resetFixtures,
  resetKnockout,
  saveFixtureConfig,
  undrawPosition,
  unlockDraw,
} from "@/lib/fixtures/service";
import { listFixtureTournaments } from "@/lib/fixtures/queries";
import { fixtureActionSchema } from "@/lib/validations/fixtures";

async function requireAdmin() {
  const user = await getCurrentUser();
  if (!canAccessAdmin(user)) {
    return { error: NextResponse.json({ error: "Forbidden." }, { status: 403 }) };
  }
  return { user: user! };
}

function fail(err: unknown) {
  if (err instanceof FixtureError) {
    return NextResponse.json({ error: err.message }, { status: err.status });
  }
  console.error("[fixtures]", err);
  return NextResponse.json(
    { error: "Could not update tournament fixtures." },
    { status: 500 },
  );
}

export async function GET(request: Request) {
  const auth = await requireAdmin();
  if ("error" in auth && auth.error) return auth.error;

  const url = new URL(request.url);
  const tournamentId = url.searchParams.get("tournament_id");
  if (!tournamentId) {
    try {
      const tournaments = await listFixtureTournaments();
      return NextResponse.json({ tournaments });
    } catch (err) {
      return fail(err);
    }
  }

  try {
    const workspace = await getFixtureWorkspace(tournamentId);
    return NextResponse.json(workspace);
  } catch (err) {
    return fail(err);
  }
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

  const parsed = fixtureActionSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input." },
      { status: 400 },
    );
  }

  try {
    const input = parsed.data;
    switch (input.action) {
      case "save_config":
        return NextResponse.json(await saveFixtureConfig(auth.user, input));
      case "draw_team":
        return NextResponse.json(
          await drawTeam(auth.user, input.tournament_id, input.team_id),
        );
      case "undraw_position":
        return NextResponse.json(
          await undrawPosition(auth.user, input.tournament_id, input.draw_position),
        );
      case "confirm_draw":
        return NextResponse.json(await confirmDraw(auth.user, input.tournament_id));
      case "unlock_draw":
        return NextResponse.json(
          await unlockDraw(auth.user, input.tournament_id, input.confirm),
        );
      case "preview_league":
        return NextResponse.json({
          preview: await previewLeague(input.tournament_id),
        });
      case "confirm_league":
        return NextResponse.json(
          await confirmLeague(
            auth.user,
            input.tournament_id,
            input.replace_scheduled,
          ),
        );
      case "complete_league":
        return NextResponse.json(await completeLeague(auth.user, input.tournament_id));
      case "preview_knockout":
        return NextResponse.json({
          preview: await previewKnockout(input.tournament_id),
        });
      case "confirm_knockout":
        return NextResponse.json(
          await confirmKnockout(
            auth.user,
            input.tournament_id,
            input.replace_scheduled,
          ),
        );
      case "reset_knockout":
        return NextResponse.json(
          await resetKnockout(auth.user, input.tournament_id, input.confirm),
        );
      case "reset_fixtures":
        return NextResponse.json(
          await resetFixtures(auth.user, input.tournament_id, input.confirm),
        );
      default:
        return NextResponse.json({ error: "Unknown action." }, { status: 400 });
    }
  } catch (err) {
    return fail(err);
  }
}
