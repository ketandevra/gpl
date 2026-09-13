import { NextResponse } from "next/server";
import {
  getMatchById,
  listInningsForMatch,
  listMatchScorerIds,
} from "@/lib/matches/queries";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_request: Request, context: Ctx) {
  const { id } = await context.params;
  const match = await getMatchById(id);
  if (!match) {
    return NextResponse.json({ error: "Match not found." }, { status: 404 });
  }

  const [innings, scorer_ids] = await Promise.all([
    listInningsForMatch(id),
    listMatchScorerIds(id),
  ]);

  return NextResponse.json({ match, innings, scorer_ids });
}
