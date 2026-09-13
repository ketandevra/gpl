import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { getScoreboard } from "@/lib/scoring/queries";
import {
  recordBall,
  setPlayers,
  startInnings,
  undoLastBall,
} from "@/lib/scoring/service";
import {
  recordBallSchema,
  setPlayersSchema,
  startInningsSchema,
} from "@/lib/validations/scoring";
import { z } from "zod";

type Ctx = { params: Promise<{ matchId: string }> };

async function requireUser() {
  const user = await getCurrentUser();
  if (!user) {
    return {
      error: NextResponse.json({ error: "Sign in required." }, { status: 401 }),
    };
  }
  return { user };
}

export async function GET(_request: Request, ctx: Ctx) {
  const { matchId } = await ctx.params;
  const user = await getCurrentUser();
  const board = await getScoreboard(matchId, user);
  if (!board) {
    return NextResponse.json({ error: "Match not found." }, { status: 404 });
  }
  return NextResponse.json(board);
}

export async function POST(request: Request, ctx: Ctx) {
  const auth = await requireUser();
  if ("error" in auth && auth.error) return auth.error;
  const { matchId } = await ctx.params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const action = z
    .object({
      action: z.enum(["start_innings", "set_players", "ball", "undo"]),
    })
    .safeParse(body);

  if (!action.success) {
    return NextResponse.json(
      { error: "action must be start_innings, set_players, ball, or undo." },
      { status: 400 },
    );
  }

  if (action.data.action === "undo") {
    const result = await undoLastBall(auth.user, matchId);
    if ("error" in result) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }
    return NextResponse.json(result.board);
  }

  if (action.data.action === "start_innings") {
    const parsed = startInningsSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Invalid input." },
        { status: 400 },
      );
    }
    const result = await startInnings(auth.user, matchId, parsed.data);
    if ("error" in result) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }
    return NextResponse.json(result.board);
  }

  if (action.data.action === "set_players") {
    const parsed = setPlayersSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Invalid input." },
        { status: 400 },
      );
    }
    const result = await setPlayers(auth.user, matchId, parsed.data);
    if ("error" in result) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }
    return NextResponse.json(result.board);
  }

  const parsed = recordBallSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input." },
      { status: 400 },
    );
  }
  const result = await recordBall(auth.user, matchId, parsed.data);
  if ("error" in result) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }
  return NextResponse.json(result.board);
}
