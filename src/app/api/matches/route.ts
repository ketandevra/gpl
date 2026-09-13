import { NextResponse } from "next/server";
import { listMatches, LIVE_MATCH_STATUSES } from "@/lib/matches/queries";
import { isSupabaseAdminConfigured } from "@/lib/supabase/env";

export async function GET(request: Request) {
  if (!isSupabaseAdminConfigured()) {
    return NextResponse.json({ matches: [] });
  }

  const { searchParams } = new URL(request.url);
  const filter = searchParams.get("filter"); // live | upcoming | completed | all

  let matches = await listMatches();
  if (filter === "live") {
    matches = matches.filter((m) => LIVE_MATCH_STATUSES.includes(m.status));
  } else if (filter === "upcoming") {
    matches = matches.filter((m) => m.status === "scheduled");
  } else if (filter === "completed") {
    matches = matches.filter((m) =>
      ["completed", "abandoned"].includes(m.status),
    );
  }

  return NextResponse.json({ matches });
}
