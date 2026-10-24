import Link from "next/link";
import { notFound } from "next/navigation";
import { IconBat, IconShirt, IconTeam } from "@/components/ui/Icons";
import { VerifiedBadge } from "@/components/ui/VerifiedBadge";
import { getCurrentUser } from "@/lib/auth/session";
import { canAccessAdmin } from "@/lib/auth/permissions";
import { getCareerStats } from "@/lib/stats";
import {
  formatPlayerLabel,
  getPlayerById,
  getTeamById,
  playerRoleLabel,
  teamStatusLabel,
} from "@/lib/teams/queries";
import { adminRest, withRetry } from "@/lib/supabase/rest";
import { isSupabaseAdminConfigured } from "@/lib/supabase/env";
import { formatAadhaarInput } from "@/lib/verification/helpers";

function initials(name: string) {
  return name
    .split(/\s+/)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

type PageProps = {
  params: Promise<{ id: string }>;
};

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: PageProps) {
  const { id } = await params;
  const player = await getPlayerById(id);
  return { title: player ? formatPlayerLabel(player) : "Player" };
}

export default async function PlayerDetailPage({ params }: PageProps) {
  const { id } = await params;
  const [player, viewer] = await Promise.all([
    getPlayerById(id),
    getCurrentUser(),
  ]);
  if (!player) notFound();
  const isAdmin = canAccessAdmin(viewer);

  const configured = isSupabaseAdminConfigured();
  const [lockedTeam, career, memberships, linkedUsers] = await Promise.all([
    player.locked_team_id ? getTeamById(player.locked_team_id) : null,
    configured ? getCareerStats(id).catch(() => null) : null,
    configured
      ? withRetry(() =>
          adminRest<Array<{ team_id: string; jersey_number: number | null }>>(
            "team_players",
            {
              query: `?player_id=eq.${encodeURIComponent(id)}&select=team_id,jersey_number&limit=10`,
            },
          ),
        )
      : Promise.resolve([]),
    configured && player.user_id
      ? withRetry(() =>
          adminRest<
            Array<{
              avatar_url: string | null;
              verification_status: string;
              mobile_number: string | null;
              aadhaar_number: string | null;
            }>
          >("users", {
            query: `?id=eq.${encodeURIComponent(player.user_id!)}&select=${
              isAdmin
                ? "avatar_url,verification_status,mobile_number,aadhaar_number"
                : "avatar_url,verification_status"
            }&limit=1`,
          }),
        )
      : Promise.resolve([]),
  ]);
  const stats = career?.career ?? null;

  const squadTeams: Array<{
    id: string;
    name: string;
    short_name: string;
    approved: boolean;
    registration_status: string;
    jersey_number: number | null;
  }> = [];
  let avatarUrl: string | null =
    linkedUsers[0]?.avatar_url ?? player.photo_url;
  let verified = linkedUsers[0]?.verification_status === "verified";
  let mobileNumber = linkedUsers[0]?.mobile_number ?? player.mobile_number;
  let aadhaarNumber: string | null = linkedUsers[0]?.aadhaar_number ?? null;

  if (memberships.length) {
    const teamIds = [...new Set(memberships.map((row) => row.team_id))];
    const teams = teamIds.length
      ? await withRetry(() =>
          adminRest<
            Array<{
              id: string;
              name: string;
              short_name: string;
              approved: boolean;
              registration_status: string;
            }>
          >("teams", {
            query: `?id=in.(${teamIds.join(",")})&select=id,name,short_name,approved,registration_status`,
          }),
        )
      : [];
    const teamById = new Map(teams.map((team) => [team.id, team]));
    for (const m of memberships) {
      const t = teamById.get(m.team_id);
      if (t && t.registration_status !== "rejected") {
        squadTeams.push({
          id: t.id,
          name: t.name,
          short_name: t.short_name,
          approved: t.approved,
          registration_status: t.registration_status,
          jersey_number: m.jersey_number,
        });
      }
    }
  }

  const primaryJersey =
    squadTeams.find((t) => t.approved)?.jersey_number ??
    squadTeams[0]?.jersey_number ??
    null;
  const otherSquads = squadTeams.filter((team) => team.id !== lockedTeam?.id);
  const hasDetails = Boolean(
    player.tshirt_size ||
      player.batting_style ||
      player.bowling_style ||
      lockedTeam ||
      squadTeams.length ||
      (isAdmin && (mobileNumber || aadhaarNumber)),
  );

  return (
    <div className="mx-auto max-w-lg overflow-x-hidden px-3 pb-6 pt-2 sm:px-4">
      <article className="relative overflow-hidden rounded-[1.75rem] bg-[#3e2723] shadow-[0_18px_40px_rgba(62,39,35,0.24)]">
        <div className="relative aspect-[4/5] min-h-[22rem]">
          {avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={avatarUrl}
              alt=""
              className="absolute inset-0 h-full w-full object-cover object-[center_18%]"
            />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center bg-[#2aa7ad]/20 text-6xl font-bold text-[#f5b830]">
              {initials(player.name)}
            </div>
          )}
          <div
            className="absolute inset-0 bg-gradient-to-t from-[#3e2723] via-[#3e2723]/30 to-transparent"
            aria-hidden
          />
          <div className="absolute inset-x-0 bottom-0 px-5 pb-5 pt-20">
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[#f5b830]">
              {playerRoleLabel(player.role)}
              {primaryJersey != null ? ` · #${primaryJersey}` : ""}
            </p>
            <h1 className="mt-1.5 text-[1.85rem] font-bold leading-tight text-white sm:text-4xl">
              {player.name}
            </h1>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center rounded-full bg-white/12 px-3 py-1 text-sm font-semibold tracking-wide text-white">
                {player.public_code}
              </span>
              {verified ? <VerifiedBadge /> : null}
            </div>
          </div>
        </div>
      </article>

      {hasDetails ? (
        <section className="mt-4 overflow-hidden rounded-[1.35rem] bg-white/90 shadow-[0_8px_22px_rgba(62,39,35,0.06)]">
          {isAdmin && mobileNumber ? (
            <div className="flex items-center justify-between gap-3 px-4 py-3">
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#3e2723]/40">
                Mobile
              </p>
              <p className="text-sm font-semibold tabular-nums text-[#3e2723]">
                {mobileNumber}
              </p>
            </div>
          ) : null}
          {isAdmin ? (
            <div className="flex items-center justify-between gap-3 border-t border-[#3e2723]/6 px-4 py-3">
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#3e2723]/40">
                Aadhaar
              </p>
              <p className="text-sm font-semibold tabular-nums text-[#3e2723]">
                {aadhaarNumber
                  ? formatAadhaarInput(aadhaarNumber)
                  : "Not on file"}
              </p>
            </div>
          ) : null}

          <div className="divide-y divide-[#3e2723]/6">
            {player.tshirt_size ? (
              <div className="flex items-center gap-2.5 px-4 py-3.5">
                <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[#2aa7ad]/10 text-[#1a7f84]">
                  <IconShirt />
                </span>
                <div>
                  <p className="text-[11px] font-medium text-[#3e2723]/45">
                    T-shirt
                  </p>
                  <p className="text-sm font-semibold text-[#3e2723]">
                    {player.tshirt_size}
                  </p>
                </div>
              </div>
            ) : null}
            {player.batting_style ? (
              <div className="flex items-center gap-2.5 px-4 py-3.5">
                <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[#f5b830]/15 text-[#8a6500]">
                  <IconBat />
                </span>
                <div>
                  <p className="text-[11px] font-medium text-[#3e2723]/45">
                    Batting
                  </p>
                  <p className="text-sm font-semibold text-[#3e2723]">
                    {player.batting_style}
                  </p>
                </div>
              </div>
            ) : null}
            {player.bowling_style ? (
              <div className="flex items-center gap-2.5 px-4 py-3.5">
                <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[#f5b830]/15 text-[#8a6500]">
                  <IconBat />
                </span>
                <div>
                  <p className="text-[11px] font-medium text-[#3e2723]/45">
                    Bowling
                  </p>
                  <p className="text-sm font-semibold text-[#3e2723]">
                    {player.bowling_style}
                  </p>
                </div>
              </div>
            ) : null}
            {lockedTeam || squadTeams.length ? (
              <div className="flex items-start gap-2.5 px-4 py-3.5">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#2aa7ad]/10 text-[#1a7f84]">
                  <IconTeam />
                </span>
                <div className="min-w-0">
                  <p className="text-[11px] font-medium text-[#3e2723]/45">
                    Team
                  </p>
                  <ul className="mt-0.5 space-y-1">
                    {lockedTeam ? (
                      <li>
                        <Link
                          href={`/teams/${lockedTeam.id}`}
                          className="text-sm font-semibold text-[#1a7f84]"
                        >
                          {lockedTeam.name} ({lockedTeam.short_name})
                        </Link>
                      </li>
                    ) : null}
                    {otherSquads.map((team) => (
                      <li key={team.id}>
                        <Link
                          href={`/teams/${team.id}`}
                          className="text-sm font-semibold text-[#1a7f84]"
                        >
                          {team.name} ({team.short_name})
                        </Link>
                        <span className="ml-1.5 text-[11px] text-[#3e2723]/50">
                          {teamStatusLabel(team.registration_status as never)}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            ) : null}
          </div>
        </section>
      ) : null}

      <section className="mt-4 rounded-[1.35rem] bg-white/90 p-4 shadow-[0_8px_22px_rgba(62,39,35,0.06)] sm:p-5">
        <h2 className="text-[15px] font-semibold text-[#3e2723] sm:text-lg">
          Career stats
        </h2>
        <p className="mt-1 text-xs text-[#3e2723]/50">
          All GPL editions this player has scored in
        </p>

        {!stats || (!stats.has_batting && !stats.has_bowling) ? (
          <p className="mt-4 text-sm text-[#3e2723]/60">
            No match stats yet. Stats appear after this player bats or bowls in
            a scored match.
          </p>
        ) : (
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <div className="rounded-xl border border-[#2aa7ad]/20 bg-[#2aa7ad]/5 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-[#1a7f84]">
                Batting
              </p>
              {stats.has_batting ? (
                <dl className="mt-3 space-y-2 text-sm">
                  <div className="flex justify-between gap-2">
                    <dt className="text-[#3e2723]/55">Runs</dt>
                    <dd className="font-semibold tabular-nums text-[#3e2723]">
                      {stats.batting.runs}
                    </dd>
                  </div>
                  <div className="flex justify-between gap-2">
                    <dt className="text-[#3e2723]/55">Balls</dt>
                    <dd className="font-semibold tabular-nums text-[#3e2723]">
                      {stats.batting.balls_faced}
                    </dd>
                  </div>
                  <div className="flex justify-between gap-2">
                    <dt className="text-[#3e2723]/55">Strike rate</dt>
                    <dd className="font-semibold tabular-nums text-[#3e2723]">
                      {stats.batting.strike_rate.toFixed(1)}
                    </dd>
                  </div>
                  <div className="flex justify-between gap-2">
                    <dt className="text-[#3e2723]/55">4s / 6s</dt>
                    <dd className="font-semibold tabular-nums text-[#3e2723]">
                      {stats.batting.fours} / {stats.batting.sixes}
                    </dd>
                  </div>
                </dl>
              ) : (
                <p className="mt-3 text-sm text-[#3e2723]/55">No batting yet</p>
              )}
            </div>

            <div className="rounded-xl border border-[#f5b830]/35 bg-[#fff8e8] p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-[#8a6500]">
                Bowling
              </p>
              {stats.has_bowling ? (
                <dl className="mt-3 space-y-2 text-sm">
                  <div className="flex justify-between gap-2">
                    <dt className="text-[#3e2723]/55">Wickets</dt>
                    <dd className="font-semibold tabular-nums text-[#3e2723]">
                      {stats.bowling.wickets}
                    </dd>
                  </div>
                  <div className="flex justify-between gap-2">
                    <dt className="text-[#3e2723]/55">Overs</dt>
                    <dd className="font-semibold tabular-nums text-[#3e2723]">
                      {stats.bowling.overs}
                    </dd>
                  </div>
                  <div className="flex justify-between gap-2">
                    <dt className="text-[#3e2723]/55">Runs conceded</dt>
                    <dd className="font-semibold tabular-nums text-[#3e2723]">
                      {stats.bowling.runs_conceded}
                    </dd>
                  </div>
                  <div className="flex justify-between gap-2">
                    <dt className="text-[#3e2723]/55">Economy</dt>
                    <dd className="font-semibold tabular-nums text-[#3e2723]">
                      {stats.bowling.economy.toFixed(2)}
                    </dd>
                  </div>
                </dl>
              ) : (
                <p className="mt-3 text-sm text-[#3e2723]/55">No bowling yet</p>
              )}
            </div>
          </div>
        )}

        {career && career.editions.length > 1 ? (
          <ul className="mt-4 space-y-2">
            {career.editions.map((edition) => (
              <li
                key={edition.player_id}
                className="rounded-xl border border-[#3e2723]/8 bg-[#fdf6e8]/70 px-3 py-2 text-sm"
              >
                <p className="font-semibold text-[#3e2723]">
                  {edition.tournament_name}
                </p>
                <p className="text-xs text-[#3e2723]/55">
                  {edition.stats.has_batting
                    ? `${edition.stats.batting.runs} runs`
                    : ""}
                  {edition.stats.has_batting && edition.stats.has_bowling
                    ? " · "
                    : ""}
                  {edition.stats.has_bowling
                    ? `${edition.stats.bowling.wickets} wkts`
                    : ""}
                  {!edition.stats.has_batting && !edition.stats.has_bowling
                    ? "No scored matches yet"
                    : ""}
                </p>
              </li>
            ))}
          </ul>
        ) : null}
      </section>
    </div>
  );
}
