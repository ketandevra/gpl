import Link from "next/link";
import {
  formatTournamentDates,
  tournamentStatusLabel,
  type PublicTournament,
} from "@/lib/tournaments/queries";

type Props = {
  tournaments: PublicTournament[];
};

export function HomeTournaments({ tournaments }: Props) {
  if (!tournaments.length) return null;

  return (
    <section className="mt-5 sm:mt-8">
      <div className="mb-3 flex items-end justify-between gap-2">
        <h2 className="text-lg font-semibold text-[#3e2723]">Tournaments</h2>
        <Link
          href="/teams"
          className="text-sm font-semibold text-[#1a7f84] hover:underline"
        >
          View teams
        </Link>
      </div>
      <ul className="grid gap-3 sm:grid-cols-2">
        {tournaments.map((t) => {
          const dates = formatTournamentDates(t.start_date, t.end_date);
          const href = t.registration_open ? "/teams" : "/matches";
          const statusTone =
            t.status === "ongoing"
              ? "bg-[#2aa7ad]/12 text-[#1a7f84]"
              : "bg-[#f5b830]/20 text-[#8a6500]";

          return (
            <li key={t.id}>
              <Link
                href={href}
                className="group flex h-full flex-col rounded-2xl border border-[#3e2723]/8 bg-white/85 p-4 shadow-sm transition active:scale-[0.99] sm:p-5 sm:hover:-translate-y-0.5 sm:hover:border-[#2aa7ad]/35 sm:hover:shadow-md"
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <h3 className="font-semibold text-[#3e2723] group-hover:text-[#1a7f84]">
                    {t.name}
                    {t.short_name ? (
                      <span className="ml-1.5 font-medium text-[#3e2723]/45">
                        ({t.short_name})
                      </span>
                    ) : null}
                  </h3>
                  <div className="flex shrink-0 flex-wrap gap-1.5">
                    {t.is_active ? (
                      <span className="rounded-full bg-[#3e2723]/8 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-[#3e2723]">
                        Current
                      </span>
                    ) : null}
                    <span
                      className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${statusTone}`}
                    >
                      {tournamentStatusLabel(t.status)}
                    </span>
                  </div>
                </div>
                {dates || t.location ? (
                  <p className="mt-2 text-sm leading-snug text-[#3e2723]/65">
                    {[dates, t.location].filter(Boolean).join(" · ")}
                  </p>
                ) : null}
                {t.registration_open ? (
                  <p className="mt-3 text-xs font-semibold text-[#1a7f84]">
                    Registration open
                  </p>
                ) : null}
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
