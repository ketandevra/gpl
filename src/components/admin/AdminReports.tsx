import Link from "next/link";
import type {
  AdminReports,
  ReportCount,
  ReportPerson,
} from "@/lib/admin/reports-types";

function maxValue(rows: ReportCount[]) {
  return Math.max(1, ...rows.map((row) => row.value));
}

function CountCards({ rows }: { rows: ReportCount[] }) {
  if (!rows.length) return null;
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
      {rows.map((row) => (
        <div
          key={row.label}
          className="rounded-2xl border border-[#3e2723]/8 bg-white p-3 shadow-sm"
        >
          <p className="text-[11px] font-semibold uppercase tracking-wide text-[#3e2723]/50">
            {row.label}
          </p>
          <p className="mt-1 text-2xl font-bold text-[#3e2723]">{row.value}</p>
        </div>
      ))}
    </div>
  );
}

function Bars({ title, rows }: { title: string; rows: ReportCount[] }) {
  if (!rows.length) {
    return (
      <section className="rounded-2xl border border-[#3e2723]/10 bg-white p-4 shadow-sm">
        <h2 className="text-sm font-bold text-[#3e2723]">{title}</h2>
        <p className="mt-2 text-sm text-[#3e2723]/50">No data yet.</p>
      </section>
    );
  }
  const max = maxValue(rows);
  return (
    <section className="rounded-2xl border border-[#3e2723]/10 bg-white p-4 shadow-sm">
      <h2 className="text-sm font-bold text-[#3e2723]">{title}</h2>
      <ul className="mt-3 space-y-2">
        {rows.map((row) => (
          <li key={row.label}>
            <div className="flex items-baseline justify-between gap-2 text-sm">
              <span className="text-[#3e2723]/75">{row.label}</span>
              <span className="font-semibold text-[#3e2723]">{row.value}</span>
            </div>
            <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-[#3e2723]/8">
              <div
                className="h-full rounded-full bg-[#2aa7ad]"
                style={{ width: `${Math.round((row.value / max) * 100)}%` }}
              />
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

function PersonList({
  title,
  rows,
  empty,
}: {
  title: string;
  rows: ReportPerson[];
  empty: string;
}) {
  return (
    <section className="rounded-2xl border border-[#3e2723]/10 bg-white p-4 shadow-sm">
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="text-sm font-bold text-[#3e2723]">{title}</h2>
        <span className="text-xs text-[#3e2723]/45">{rows.length}</span>
      </div>
      {rows.length === 0 ? (
        <p className="mt-2 text-sm text-[#3e2723]/50">{empty}</p>
      ) : (
        <ul className="mt-3 divide-y divide-[#3e2723]/8">
          {rows.map((row, index) => (
            <li key={`${row.name}-${row.mobile}-${index}`} className="py-2">
              <Link href={row.href ?? "/admin/users"} className="block">
                <p className="text-sm font-semibold text-[#3e2723]">
                  {row.player_id ? `${row.player_id} - ${row.name}` : row.name}
                </p>
                <p className="text-xs text-[#3e2723]/55">
                  {[row.mobile, row.detail].filter(Boolean).join(" · ")}
                </p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export function AdminReports({ reports }: { reports: AdminReports }) {
  return (
    <div className="px-3 py-5 sm:px-4 sm:py-8 lg:px-8">
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#2aa7ad]">
        Admin
      </p>
      <h1 className="mt-2 text-2xl font-bold text-[#3e2723]">Reports</h1>
      <p className="mt-1 text-sm text-[#3e2723]/60">
        {reports.tournament_name
          ? `${reports.tournament_name} · squad size ${reports.squad_size}`
          : "No active tournament · showing all users"}
      </p>

      <div className="mt-4">
        <CountCards rows={reports.snapshot} />
      </div>

      <div className="mt-4 grid gap-3 lg:grid-cols-2">
        <Bars title="Signups · last 7 days" rows={reports.signups_7d} />
        <Bars title="Unique logins · last 7 days" rows={reports.logins_7d} />
        <Bars title="Verification" rows={reports.verification} />
        <Bars title="User roles" rows={reports.user_roles} />
        <Bars title="Teams" rows={reports.team_status} />
        <Bars title="Matches" rows={reports.match_status} />
        <Bars title="Player roles" rows={reports.player_roles} />
        <Bars title="T-shirt sizes" rows={reports.tshirts} />
      </div>

      <h2 className="mt-8 text-lg font-bold text-[#3e2723]">Needs attention</h2>
      <div className="mt-3 grid gap-3 lg:grid-cols-2">
        <PersonList
          title="Pending verification"
          rows={reports.attention.pending_verification}
          empty="No pending verifications."
        />
        <PersonList
          title="Never logged in"
          rows={reports.attention.never_logged_in}
          empty="Every registered user has logged in."
        />
        <PersonList
          title="Verified, no player ID"
          rows={reports.attention.verified_no_player}
          empty="Every verified user has a player ID."
        />
        <PersonList
          title="Players not linked to a user"
          rows={reports.attention.players_unlinked}
          empty="Every player is linked to a user."
        />
        <PersonList
          title="Players not in a squad"
          rows={reports.attention.players_no_team}
          empty="Every player is in a squad."
        />
        <PersonList
          title="Players without a photo"
          rows={reports.attention.players_no_photo}
          empty="Every player has a photo."
        />
        <PersonList
          title="Unverified players on approved teams"
          rows={reports.attention.unverified_in_squads}
          empty="Approved squads are fully verified."
        />
      </div>

      <section className="mt-3 rounded-2xl border border-[#3e2723]/10 bg-white p-4 shadow-sm">
        <h2 className="text-sm font-bold text-[#3e2723]">Teams short of squad</h2>
        {reports.attention.short_squads.length === 0 ? (
          <p className="mt-2 text-sm text-[#3e2723]/50">
            No open teams are below squad size {reports.squad_size}.
          </p>
        ) : (
          <ul className="mt-3 divide-y divide-[#3e2723]/8">
            {reports.attention.short_squads.map((team) => (
              <li key={team.name} className="py-2">
                <Link href={team.href} className="block">
                  <p className="text-sm font-semibold text-[#3e2723]">
                    {team.name}
                  </p>
                  <p className="text-xs text-[#3e2723]/55">
                    {team.status} · {team.squad}/{team.needed} players ·{" "}
                    {team.verified} verified
                  </p>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="mt-3 rounded-2xl border border-[#3e2723]/10 bg-white p-4 shadow-sm">
        <h2 className="text-sm font-bold text-[#3e2723]">Same name, multiple accounts</h2>
        {reports.attention.duplicate_names.length === 0 ? (
          <p className="mt-2 text-sm text-[#3e2723]/50">
            No repeated full names across users.
          </p>
        ) : (
          <ul className="mt-3 space-y-3">
            {reports.attention.duplicate_names.map((group) => (
              <li key={group.name}>
                <p className="text-sm font-semibold text-[#3e2723]">
                  {group.name}
                </p>
                <ul className="mt-1 space-y-1">
                  {group.people.map((person, index) => (
                    <li
                      key={`${person.mobile}-${index}`}
                      className="text-xs text-[#3e2723]/65"
                    >
                      {person.player_id ? `${person.player_id} · ` : ""}
                      {person.detail ?? person.mobile}
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
