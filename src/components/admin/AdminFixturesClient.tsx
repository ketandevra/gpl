"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { ManualTeamDraw } from "@/components/admin/ManualTeamDraw";
import { KnockoutBracket } from "@/components/fixtures/KnockoutBracket";
import {
  progressFromTournament,
  TournamentProgress,
} from "@/components/fixtures/TournamentProgress";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { matchStatusLabel } from "@/lib/matches/labels";
import type { FixtureWorkspace } from "@/lib/fixtures/service";
import { allowedQualifierCounts } from "@/lib/fixtures/draw";

type TournamentOption = {
  id: string;
  name: string;
  is_active: boolean;
};

type Props = {
  initial: FixtureWorkspace | null;
  tournaments: TournamentOption[];
  selectedId: string | null;
  loadError?: string | null;
};

type ConfirmKind =
  | "league"
  | "regen_league"
  | "knockout"
  | "reset_knockout"
  | "reset_fixtures"
  | null;

async function postAction(body: Record<string, unknown>) {
  const res = await fetch("/api/admin/fixtures", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = (await res.json()) as FixtureWorkspace & { error?: string };
  if (!res.ok) throw new Error(data.error ?? "Request failed.");
  return data;
}

function groupMatches(matches: FixtureWorkspace["league_matches"]) {
  return {
    scheduled: matches.filter((match) => match.status === "scheduled"),
    live: matches.filter((match) =>
      ["live", "innings_break"].includes(match.status),
    ),
    completed: matches.filter((match) => match.status === "completed"),
    postponed: matches.filter((match) => match.status === "postponed"),
    cancelled: matches.filter((match) =>
      ["cancelled", "abandoned"].includes(match.status),
    ),
  };
}

export function AdminFixturesClient({
  initial,
  tournaments,
  selectedId,
  loadError,
}: Props) {
  const router = useRouter();
  const [workspace, setWorkspace] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(loadError ?? null);
  const [message, setMessage] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<ConfirmKind>(null);
  const [selectedTeams, setSelectedTeams] = useState<string[]>(
    initial?.participants.map((team) => team.id) ??
      initial?.teams.map((team) => team.id) ??
      [],
  );
  const [minMatches, setMinMatches] = useState(
    initial?.tournament.min_league_matches ?? 2,
  );
  const [qualifiers, setQualifiers] = useState(
    initial?.tournament.knockout_qualifiers ?? 4,
  );
  const [method, setMethod] = useState<"minimum" | "round_robin">(
    initial?.tournament.league_method ?? "minimum",
  );

  const current = workspace
    ? progressFromTournament(workspace.tournament)
    : "draw";
  const grouped = useMemo(
    () => groupMatches(workspace?.league_matches ?? []),
    [workspace],
  );
  const qualifierOptions = allowedQualifierCounts(selectedTeams.length);

  async function run(action: Record<string, unknown>, okMessage: string) {
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const next = await postAction(action);
      setWorkspace(next);
      setMessage(okMessage);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Request failed.");
    } finally {
      setBusy(false);
    }
  }

  if (!tournaments.length) {
    return (
      <div className="px-3 py-5 sm:px-4 sm:py-8 lg:px-8">
        <h1 className="text-2xl font-bold text-[#3e2723]">Fixtures</h1>
        <p className="mt-3 text-sm text-[#3e2723]/70">
          Create a tournament first, then return here to run the draw and
          generate fixtures.
        </p>
        <Link
          href="/admin/tournaments"
          className="mt-4 inline-flex text-sm font-semibold text-[#1a7f84]"
        >
          Go to tournaments
        </Link>
      </div>
    );
  }

  return (
    <div className="px-3 py-5 sm:px-4 sm:py-8 lg:px-8">
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#2aa7ad]">
        Admin
      </p>
      <h1 className="mt-2 text-2xl font-bold text-[#3e2723]">Fixtures</h1>
      <p className="mt-1 text-sm text-[#3e2723]/65">
        Manual slip draw → league → standings → knockout → champion.
      </p>

      <label className="mt-4 block">
        <span className="mb-1 block text-sm text-[#3e2723]/70">Tournament</span>
        <select
          value={selectedId ?? ""}
          onChange={(event) => {
            router.push(`/admin/fixtures?tournament=${event.target.value}`);
          }}
          className="field-select"
        >
          {tournaments.map((row) => (
            <option key={row.id} value={row.id}>
              {row.name}
              {row.is_active ? " (active)" : ""}
            </option>
          ))}
        </select>
      </label>

      {workspace ? (
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <TournamentProgress current={current} />
          <button
            type="button"
            disabled={busy}
            onClick={() => setConfirm("reset_fixtures")}
            className="rounded-full border border-[#d81b60]/30 px-4 py-2 text-xs font-semibold text-[#9f1239] disabled:opacity-50"
          >
            Reset fixtures
          </button>
        </div>
      ) : null}

      {error ? (
        <p className="mt-4 text-sm text-[#9f1239]" role="alert">
          {error}
        </p>
      ) : null}
      {message ? (
        <p className="mt-4 text-sm text-[#1a7f84]" role="status">
          {message}
        </p>
      ) : null}

      {!workspace ? (
        <p className="mt-6 text-sm text-[#3e2723]/65">
          {loadError ??
            "Apply the fixture migrations in Supabase, then reload this page."}
        </p>
      ) : (
        <div className="mt-6 space-y-5">
          <section className="rounded-2xl border border-[#3e2723]/10 bg-white p-4 shadow-sm sm:p-5">
            <h2 className="text-lg font-bold text-[#3e2723]">
              Tournament setup
            </h2>
            <p className="mt-1 text-sm text-[#3e2723]/65">
              {workspace.participants.length} selected · format League +
              Knockout · draw{" "}
              {workspace.tournament.draw_status === "confirmed"
                ? "confirmed"
                : workspace.tournament.draw_status.replace("_", " ")}
            </p>

            <fieldset className="mt-4">
              <legend className="text-sm font-semibold text-[#3e2723]">
                Registered teams
              </legend>
              <div className="mt-2 grid gap-2 sm:grid-cols-2">
                {workspace.teams.map((team) => {
                  const checked = selectedTeams.includes(team.id);
                  return (
                    <label
                      key={team.id}
                      className="flex items-center gap-2 rounded-xl border border-[#3e2723]/10 px-3 py-2 text-sm"
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        disabled={
                          busy || workspace.tournament.draw_status === "confirmed"
                        }
                        onChange={(event) => {
                          setSelectedTeams((currentTeams) =>
                            event.target.checked
                              ? [...currentTeams, team.id]
                              : currentTeams.filter((id) => id !== team.id),
                          );
                        }}
                      />
                      <span className="font-medium text-[#3e2723]">
                        {team.name}
                      </span>
                    </label>
                  );
                })}
              </div>
            </fieldset>

            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              <label className="block">
                <span className="mb-1 block text-sm text-[#3e2723]/70">
                  Min league matches
                </span>
                <input
                  type="number"
                  min={1}
                  max={32}
                  value={minMatches}
                  disabled={workspace.tournament.draw_status === "confirmed"}
                  onChange={(event) =>
                    setMinMatches(Number(event.target.value) || 2)
                  }
                  className="field"
                />
              </label>
              <label className="block">
                <span className="mb-1 block text-sm text-[#3e2723]/70">
                  Knockout qualifiers
                </span>
                <select
                  value={qualifiers}
                  disabled={workspace.tournament.draw_status === "confirmed"}
                  onChange={(event) =>
                    setQualifiers(Number(event.target.value) as 2 | 4 | 8 | 16)
                  }
                  className="field-select"
                >
                  {(qualifierOptions.length ? qualifierOptions : [2]).map(
                    (count) => (
                      <option key={count} value={count}>
                        Top {count}
                      </option>
                    ),
                  )}
                </select>
              </label>
              <label className="block">
                <span className="mb-1 block text-sm text-[#3e2723]/70">
                  League format
                </span>
                <select
                  value={method}
                  disabled={workspace.tournament.draw_status === "confirmed"}
                  onChange={(event) =>
                    setMethod(event.target.value as "minimum" | "round_robin")
                  }
                  className="field-select"
                >
                  <option value="minimum">Minimum matches</option>
                  <option value="round_robin">Full round-robin</option>
                </select>
              </label>
            </div>

            <button
              type="button"
              disabled={busy || workspace.tournament.draw_status === "confirmed"}
              onClick={() =>
                void run(
                  {
                    action: "save_config",
                    tournament_id: workspace.tournament.id,
                    team_ids: selectedTeams,
                    min_league_matches: minMatches,
                    knockout_qualifiers: qualifiers,
                    league_method: method,
                  },
                  "Tournament fixture settings saved.",
                )
              }
              className="mt-4 rounded-full bg-[#2aa7ad] px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
            >
              Save setup
            </button>
            <Link
              href={`/admin/fixtures/draw?tournament=${workspace.tournament.id}`}
              className="ml-2 inline-flex rounded-full border border-[#2aa7ad]/40 px-4 py-2.5 text-sm font-semibold text-[#1a7f84]"
            >
              Open Manual Team Draw
            </Link>
          </section>

          <ManualTeamDraw
            workspace={workspace}
            busy={busy}
            error={null}
            message={null}
            onDraw={(teamId) =>
              void run(
                {
                  action: "draw_team",
                  tournament_id: workspace.tournament.id,
                  team_id: teamId,
                },
                "Team added to the draw.",
              )
            }
            onUndraw={(position) =>
              void run(
                {
                  action: "undraw_position",
                  tournament_id: workspace.tournament.id,
                  draw_position: position,
                },
                "Draw position cleared.",
              )
            }
            onConfirm={() =>
              void run(
                {
                  action: "confirm_draw",
                  tournament_id: workspace.tournament.id,
                },
                "Draw confirmed. League fixtures can now be generated.",
              )
            }
            onUnlock={() =>
              void run(
                {
                  action: "unlock_draw",
                  tournament_id: workspace.tournament.id,
                  confirm: true,
                },
                "Draw unlocked.",
              )
            }
          />

          <section className="rounded-2xl border border-[#3e2723]/10 bg-white p-4 shadow-sm sm:p-5">
            <h2 className="text-lg font-bold text-[#3e2723]">
              League fixtures
            </h2>
            {workspace.league_preview ? (
              <>
                <dl className="mt-3 grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
                  <div className="rounded-xl bg-[#fdf6e8] px-3 py-2">
                    <dt className="text-xs text-[#3e2723]/55">Teams</dt>
                    <dd className="font-bold">
                      {workspace.league_preview.team_count}
                    </dd>
                  </div>
                  <div className="rounded-xl bg-[#fdf6e8] px-3 py-2">
                    <dt className="text-xs text-[#3e2723]/55">Matches</dt>
                    <dd className="font-bold">
                      {workspace.league_preview.total_matches}
                    </dd>
                  </div>
                  <div className="rounded-xl bg-[#fdf6e8] px-3 py-2">
                    <dt className="text-xs text-[#3e2723]/55">Duplicates</dt>
                    <dd className="font-bold">
                      {workspace.league_preview.duplicate_pairings}
                    </dd>
                  </div>
                  <div className="rounded-xl bg-[#fdf6e8] px-3 py-2">
                    <dt className="text-xs text-[#3e2723]/55">Validation</dt>
                    <dd className="font-bold text-[#1a7f84]">Valid</dd>
                  </div>
                </dl>
                <ul className="mt-3 space-y-1 text-xs text-[#3e2723]/70">
                  {workspace.league_preview.team_counts.map((row) => (
                    <li key={row.team_id}>
                      {row.team_name}: {row.matches} matches
                      {row.byes ? ` · ${row.byes} ${row.byes === 1 ? "bye" : "byes"}` : ""}
                    </li>
                  ))}
                </ul>
                <div className="mt-4 space-y-3">
                  {workspace.league_preview.rounds.map((round) => (
                    <div key={round.round_number}>
                      <p className="text-xs font-bold uppercase tracking-wide text-[#1a7f84]">
                        Round {round.round_number}
                        {round.byes.length
                          ? ` · bye: ${round.byes
                              .map(
                                (id) =>
                                  workspace.participants.find((team) => team.id === id)
                                    ?.name ?? id,
                              )
                              .join(", ")}`
                          : ""}
                      </p>
                      <ul className="mt-1 space-y-1 text-sm">
                        {workspace.league_preview!.fixtures
                          .filter((fixture) => fixture.round_number === round.round_number)
                          .map((fixture) => (
                            <li key={fixture.match_number}>
                              M{fixture.match_number}. {fixture.team_a_name} vs{" "}
                              {fixture.team_b_name}
                            </li>
                          ))}
                      </ul>
                    </div>
                  ))}
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() =>
                      setConfirm(
                        workspace.tournament.league_fixtures_confirmed
                          ? "regen_league"
                          : "league",
                      )
                    }
                    className="rounded-full bg-[#2aa7ad] px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
                  >
                    {workspace.tournament.league_fixtures_confirmed
                      ? "Regenerate scheduled fixtures"
                      : "Confirm league fixtures"}
                  </button>
                </div>
              </>
            ) : (
              <p className="mt-2 text-sm text-[#3e2723]/60">
                Confirm the manual draw to preview league fixtures.
              </p>
            )}

            {workspace.league_matches.length ? (
              <div className="mt-5 space-y-3">
                {(
                  [
                    ["Scheduled", grouped.scheduled],
                    ["In progress", grouped.live],
                    ["Completed", grouped.completed],
                    ["Postponed", grouped.postponed],
                    ["Cancelled", grouped.cancelled],
                  ] as const
                ).map(([label, list]) => (
                  <div key={label}>
                    <p className="text-xs font-bold uppercase tracking-wide text-[#3e2723]/50">
                      {label} ({list.length})
                    </p>
                    <ul className="mt-1 space-y-1 text-sm">
                      {list.map((match) => (
                        <li key={match.id}>
                          <Link
                            href={`/admin/matches`}
                            className="font-medium text-[#3e2723] hover:text-[#1a7f84]"
                          >
                            {workspace.participants.find((team) => team.id === match.team_a_id)?.name}{" "}
                            vs{" "}
                            {workspace.participants.find((team) => team.id === match.team_b_id)?.name}
                          </Link>
                          <span className="text-xs text-[#3e2723]/50">
                            {" "}
                            · R{match.round_number ?? "–"} ·{" "}
                            {matchStatusLabel(match.status)}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            ) : null}
          </section>

          <section className="rounded-2xl border border-[#3e2723]/10 bg-white p-4 shadow-sm sm:p-5">
            <h2 className="text-lg font-bold text-[#3e2723]">
              League standings
            </h2>
            <div className="mt-3 overflow-x-auto">
              <table className="w-full min-w-[520px] text-left text-sm">
                <thead className="bg-[#fdf6e8] text-[11px] font-semibold uppercase tracking-wide text-[#3e2723]/55">
                  <tr>
                    <th className="px-2 py-2">#</th>
                    <th className="px-2 py-2">Team</th>
                    <th className="px-2 py-2 text-center">P</th>
                    <th className="px-2 py-2 text-center">W</th>
                    <th className="px-2 py-2 text-center">T</th>
                    <th className="px-2 py-2 text-center">L</th>
                    <th className="px-2 py-2 text-center">Pts</th>
                    <th className="px-2 py-2 text-center">Left</th>
                  </tr>
                </thead>
                <tbody>
                  {workspace.standings.map((row) => (
                    <tr key={row.team_id} className="border-t border-[#3e2723]/8">
                      <td className="px-2 py-2 font-bold">{row.rank}</td>
                      <td className="px-2 py-2 font-medium">{row.team_name}</td>
                      <td className="px-2 py-2 text-center">{row.played}</td>
                      <td className="px-2 py-2 text-center">{row.won}</td>
                      <td className="px-2 py-2 text-center">{row.tied}</td>
                      <td className="px-2 py-2 text-center">{row.lost}</td>
                      <td className="px-2 py-2 text-center font-bold">
                        {row.points}
                      </td>
                      <td className="px-2 py-2 text-center">{row.remaining}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {!workspace.eligibility.ok ? (
              <ul className="mt-3 space-y-1 text-sm text-[#9f1239]">
                {workspace.eligibility.issues.map((issue) => (
                  <li key={issue.code + issue.message}>{issue.message}</li>
                ))}
              </ul>
            ) : (
              <p className="mt-3 text-sm text-[#1a7f84]">
                League eligibility is satisfied.
              </p>
            )}
            <button
              type="button"
              disabled={busy || workspace.tournament.league_stage_completed}
              onClick={() =>
                void run(
                  {
                    action: "complete_league",
                    tournament_id: workspace.tournament.id,
                  },
                  "League stage marked complete.",
                )
              }
              className="mt-4 rounded-full border border-[#2aa7ad]/40 px-4 py-2.5 text-sm font-semibold text-[#1a7f84] disabled:opacity-50"
            >
              {workspace.tournament.league_stage_completed
                ? "League stage complete"
                : "Mark league stage complete"}
            </button>
          </section>

          <section className="rounded-2xl border border-[#3e2723]/10 bg-white p-4 shadow-sm sm:p-5">
            <h2 className="text-lg font-bold text-[#3e2723]">Knockout</h2>
            <KnockoutBracket
              preview={workspace.knockout_preview}
              matches={workspace.knockout_matches}
              teams={workspace.participants}
              championName={workspace.champion?.name}
            />
            <div className="mt-4 flex flex-wrap gap-2">
              <button
                type="button"
                disabled={busy || !workspace.eligibility.ok}
                onClick={() =>
                  setConfirm(
                    workspace.knockout_matches.length ? "reset_knockout" : "knockout",
                  )
                }
                className="rounded-full bg-[#2aa7ad] px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
              >
                {workspace.knockout_matches.length
                  ? "Reset / regenerate knockout"
                  : "Generate knockout bracket"}
              </button>
            </div>
          </section>
        </div>
      )}

      {confirm === "league" || confirm === "regen_league" ? (
        <ConfirmDialog
          title={
            confirm === "regen_league"
              ? "Replace scheduled league fixtures?"
              : "Confirm league fixtures?"
          }
          body={
            confirm === "regen_league"
              ? "Scheduled generated league matches will be replaced using the same confirmed draw order. Completed matches and scores are not overwritten."
              : "Save the generated league schedule. The confirmed draw order will be used exactly; teams are not shuffled."
          }
          confirmLabel={confirm === "regen_league" ? "Replace scheduled" : "Confirm fixtures"}
          busy={busy}
          onCancel={() => setConfirm(null)}
          onConfirm={() => {
            const replace = confirm === "regen_league";
            setConfirm(null);
            void run(
              {
                action: "confirm_league",
                tournament_id: workspace!.tournament.id,
                replace_scheduled: replace,
              },
              "League fixtures saved.",
            );
          }}
        />
      ) : null}

      {confirm === "knockout" ? (
        <ConfirmDialog
          title="Generate knockout bracket?"
          body="Top teams from the league standings will be seeded. The original manual draw is not changed."
          confirmLabel="Generate knockout"
          busy={busy}
          onCancel={() => setConfirm(null)}
          onConfirm={() => {
            setConfirm(null);
            void run(
              {
                action: "confirm_knockout",
                tournament_id: workspace!.tournament.id,
                replace_scheduled: false,
              },
              "Knockout bracket saved.",
            );
          }}
        />
      ) : null}

      {confirm === "reset_fixtures" ? (
        <ConfirmDialog
          title="Reset fixtures for testing?"
          body={`This deletes the manual draw, ${workspace?.league_matches.length ?? 0} league matches, ${workspace?.knockout_matches.length ?? 0} knockout matches, and all their results for ${workspace?.tournament.name ?? "this tournament"}. Teams and fixture settings stay so you can draw again.`}
          confirmLabel="Reset fixtures"
          danger
          busy={busy}
          onCancel={() => setConfirm(null)}
          onConfirm={() => {
            setConfirm(null);
            void run(
              {
                action: "reset_fixtures",
                tournament_id: workspace!.tournament.id,
                confirm: true,
              },
              "Fixtures reset. You can start the draw again.",
            );
          }}
        />
      ) : null}

      {confirm === "reset_knockout" ? (
        <ConfirmDialog
          title="Reset the knockout bracket?"
          body="This deletes generated knockout matches, including results, then you can generate a fresh bracket from current standings."
          confirmLabel="Reset knockout"
          danger
          busy={busy}
          onCancel={() => setConfirm(null)}
          onConfirm={() => {
            setConfirm(null);
            void (async () => {
              await run(
                {
                  action: "reset_knockout",
                  tournament_id: workspace!.tournament.id,
                  confirm: true,
                },
                "Knockout bracket reset.",
              );
              await run(
                {
                  action: "confirm_knockout",
                  tournament_id: workspace!.tournament.id,
                  replace_scheduled: false,
                },
                "Knockout bracket saved.",
              );
            })();
          }}
        />
      ) : null}
    </div>
  );
}
