import type { KnockoutPreview } from "@/lib/fixtures/types";
import type { MatchRow } from "@/lib/matches/types";
import { matchStatusLabel } from "@/lib/matches/labels";

type TeamBrief = { id: string; name: string; short_name?: string };

export function KnockoutBracket({
  preview,
  matches,
  teams,
  championName,
}: {
  preview: KnockoutPreview | null;
  matches: MatchRow[];
  teams: TeamBrief[];
  championName?: string | null;
}) {
  if (!preview) {
    return (
      <p className="text-sm text-[#3e2723]/60">
        The knockout bracket appears after the league stage is complete.
      </p>
    );
  }

  const byKey = new Map(
    matches
      .filter((match) => match.knockout_key)
      .map((match) => [match.knockout_key!, match]),
  );
  const names = new Map(teams.map((team) => [team.id, team.name]));

  return (
    <div className="space-y-4">
      {championName ? (
        <p className="rounded-xl bg-[#2aa7ad]/10 px-4 py-3 text-sm font-bold text-[#1a7f84]">
          Champion: {championName}
        </p>
      ) : null}
      <div className="grid gap-3 md:grid-cols-2">
        {preview.rounds.map((round) => (
          <section
            key={round.round_number}
            className="rounded-xl border border-[#3e2723]/10 bg-[#fdf6e8]/50 p-3"
          >
            <h3 className="text-xs font-bold uppercase tracking-wide text-[#1a7f84]">
              {round.name}
            </h3>
            <ul className="mt-2 space-y-2">
              {round.matches.length ? (
                round.matches.map((match) => {
                  const saved = byKey.get(match.knockout_key);
                  const teamA =
                    saved?.team_a_id
                      ? names.get(saved.team_a_id)
                      : match.team_a_name;
                  const teamB =
                    saved?.team_b_id
                      ? names.get(saved.team_b_id)
                      : match.team_b_name;
                  return (
                    <li
                      key={match.knockout_key}
                      className="rounded-lg bg-white px-3 py-2 text-sm text-[#3e2723]"
                    >
                      <p className="font-semibold">
                        {teamA ?? "TBD"} vs {teamB ?? "TBD"}
                      </p>
                      <p className="mt-0.5 text-xs text-[#3e2723]/55">
                        {saved
                          ? matchStatusLabel(saved.status)
                          : match.playable
                            ? "Ready to generate"
                            : "Waiting for teams"}
                        {saved?.winner_team_id
                          ? ` · ${names.get(saved.winner_team_id) ?? "Winner"} through`
                          : ""}
                      </p>
                    </li>
                  );
                })
              ) : (
                <li className="text-xs text-[#3e2723]/55">
                  Byes only in this round.
                </li>
              )}
            </ul>
          </section>
        ))}
      </div>
    </div>
  );
}
