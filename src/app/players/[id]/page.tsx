import Link from "next/link";
import { notFound } from "next/navigation";
import { BackLink } from "@/components/ui/BackLink";
import { UserAvatar } from "@/components/ui/UserAvatar";
import { getPlayerStats } from "@/lib/stats";
import {
  formatPlayerLabel,
  getPlayerById,
  getTeamById,
  playerRoleLabel,
  teamStatusLabel,
} from "@/lib/teams/queries";
import { adminRest, withRetry } from "@/lib/supabase/rest";
import { isSupabaseAdminConfigured } from "@/lib/supabase/env";

type PageProps = { params: Promise<{ id: string }> };

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: PageProps) {
  const { id } = await params;
  const player = await getPlayerById(id);
  return { title: player ? formatPlayerLabel(player) : "Player" };
}

export default async function PlayerDetailPage({ params }: PageProps) {
  const { id } = await params;
  const player = await getPlayerById(id);
  if (!player) notFound();

  const lockedTeam = player.locked_team_id
    ? await getTeamById(player.locked_team_id)
    : null;

  const stats = isSupabaseAdminConfigured()
    ? await getPlayerStats(id).catch(() => null)
    : null;

  const squadTeams: Array<{
    id: string;
    name: string;
    short_name: string;
    approved: boolean;
    registration_status: string;
    jersey_number: number | null;
  }> = [];
  let avatarUrl: string | null = player.photo_url;

  if (isSupabaseAdminConfigured()) {
    const memberships = await withRetry(() =>
      adminRest<Array<{ team_id: string; jersey_number: number | null }>>(
        "team_players",
        {
          query: `?player_id=eq.${encodeURIComponent(id)}&select=team_id,jersey_number&limit=10`,
        },
      ),
    );
    for (const m of memberships) {
      const t = await getTeamById(m.team_id);
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

    if (player.user_id) {
      const users = await withRetry(() =>
        adminRest<Array<{ avatar_url: string | null }>>("users", {
          query: `?id=eq.${encodeURIComponent(player.user_id!)}&select=avatar_url&limit=1`,
        }),
      );
      avatarUrl = users[0]?.avatar_url ?? player.photo_url;
    }
  }

  const primaryJersey =
    squadTeams.find((t) => t.approved)?.jersey_number ??
    squadTeams[0]?.jersey_number ??
    null;

  return (
    <div className="mx-auto max-w-lg px-4 py-8">
      <BackLink href="/players">All players</BackLink>

      <div className="mt-5 flex flex-col items-center gap-3 rounded-2xl border border-[#3e2723]/10 bg-white p-6 shadow-sm">
        <UserAvatar
          name={player.name}
          src={avatarUrl}
          size="lg"
          className="border-2 border-[#2aa7ad]/30 shadow-sm"
        />
        <h1 className="text-center text-2xl font-bold text-[#3e2723]">
          {player.name}
        </h1>
        <p className="text-sm font-semibold tracking-wide text-[#1a7f84]">
          {player.public_code}
          {primaryJersey != null ? ` · #${primaryJersey}` : ""}
        </p>
        <p className="text-sm text-[#3e2723]/65">
          {playerRoleLabel(player.role)}
        </p>
      </div>

      <dl className="mt-4 space-y-3 rounded-2xl border border-[#3e2723]/10 bg-white p-5 shadow-sm">
        <div>
          <dt className="text-xs uppercase tracking-wide text-[#3e2723]/45">
            Player ID
          </dt>
          <dd className="mt-1 font-medium text-[#3e2723]">{player.public_code}</dd>
        </div>

        <div>
          <dt className="text-xs uppercase tracking-wide text-[#3e2723]/45">
            Playing role
          </dt>
          <dd className="mt-1 font-medium text-[#3e2723]">
            {playerRoleLabel(player.role)}
          </dd>
        </div>

        {player.tshirt_size ? (
          <div>
            <dt className="text-xs uppercase tracking-wide text-[#3e2723]/45">
              T-shirt size
            </dt>
            <dd className="mt-1 font-medium text-[#3e2723]">
              {player.tshirt_size}
            </dd>
          </div>
        ) : null}

        {player.batting_style ? (
          <div>
            <dt className="text-xs uppercase tracking-wide text-[#3e2723]/45">
              Batting style
            </dt>
            <dd className="mt-1 font-medium text-[#3e2723]">
              {player.batting_style}
            </dd>
          </div>
        ) : null}

        {player.bowling_style ? (
          <div>
            <dt className="text-xs uppercase tracking-wide text-[#3e2723]/45">
              Bowling style
            </dt>
            <dd className="mt-1 font-medium text-[#3e2723]">
              {player.bowling_style}
            </dd>
          </div>
        ) : null}

        <div>
          <dt className="text-xs uppercase tracking-wide text-[#3e2723]/45">
            Official team
          </dt>
          <dd className="mt-1">
            {lockedTeam ? (
              <Link
                href={`/teams/${lockedTeam.id}`}
                className="font-medium text-[#1a7f84] hover:underline"
              >
                {lockedTeam.name} ({lockedTeam.short_name})
              </Link>
            ) : (
              <span className="text-[#3e2723]/60">
                Not locked to an approved team
              </span>
            )}
          </dd>
        </div>

        <div>
          <dt className="text-xs uppercase tracking-wide text-[#3e2723]/45">
            Squad
          </dt>
          <dd className="mt-1">
            {squadTeams.length ? (
              <ul className="space-y-2">
                {squadTeams.map((t) => (
                  <li key={t.id}>
                    <Link
                      href={`/teams/${t.id}`}
                      className="font-medium text-[#1a7f84] hover:underline"
                    >
                      {t.name} ({t.short_name})
                    </Link>
                    <span className="ml-1.5 text-xs text-[#3e2723]/55">
                      {teamStatusLabel(t.registration_status as never)}
                      {t.jersey_number != null ? ` · #${t.jersey_number}` : ""}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <span className="text-[#3e2723]/60">Not in a squad yet</span>
            )}
          </dd>
        </div>
      </dl>

      <section className="mt-4 rounded-2xl border border-[#3e2723]/10 bg-white p-5 shadow-sm">
        <h2 className="text-lg font-semibold text-[#3e2723]">Match stats</h2>
        <p className="mt-1 text-xs text-[#3e2723]/50">
          Active tournament performance
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
      </section>
    </div>
  );
}
