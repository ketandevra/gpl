const STEPS = [
  { id: "draw", label: "Manual Draw" },
  { id: "league", label: "League Fixtures" },
  { id: "standings", label: "League Standings" },
  { id: "knockout", label: "Knockout" },
  { id: "champion", label: "Champion" },
] as const;

export function TournamentProgress({
  current,
}: {
  current: "draw" | "league" | "standings" | "knockout" | "champion";
}) {
  const index = STEPS.findIndex((step) => step.id === current);
  return (
    <ol className="flex flex-wrap gap-2">
      {STEPS.map((step, stepIndex) => {
        const done = stepIndex < index;
        const active = stepIndex === index;
        return (
          <li
            key={step.id}
            className={`rounded-full px-3 py-1.5 text-[11px] font-semibold ${
              active
                ? "bg-[#2aa7ad] text-white"
                : done
                  ? "bg-[#2aa7ad]/15 text-[#1a7f84]"
                  : "bg-[#fdf6e8] text-[#3e2723]/50"
            }`}
          >
            {stepIndex + 1}. {step.label}
          </li>
        );
      })}
    </ol>
  );
}

export function progressFromTournament(input: {
  draw_status: string;
  league_fixtures_confirmed: boolean;
  league_stage_completed: boolean;
  champion_team_id: string | null;
  knockout_batch_id: string | null;
}): "draw" | "league" | "standings" | "knockout" | "champion" {
  if (input.champion_team_id) return "champion";
  if (input.knockout_batch_id || input.league_stage_completed) return "knockout";
  if (input.league_fixtures_confirmed) return "standings";
  if (input.draw_status === "confirmed") return "league";
  return "draw";
}
