import Link from "next/link";
import {
  IconBadge,
  IconBat,
  IconIdCard,
  IconTeam,
  IconTrophy,
} from "@/components/ui/Icons";
import type { VerificationStatus } from "@/lib/types/database";

type Props = {
  signedIn: boolean;
  verificationStatus: VerificationStatus | null;
  tournamentLabel: string;
  playerCount: number;
  teamCount: number;
};

function Stat({
  value,
  label,
}: {
  value: string;
  label: string;
}) {
  return (
    <div className="rounded-2xl bg-white/90 px-2 py-3 text-center shadow-[0_6px_16px_rgba(62,39,35,0.05)] ring-1 ring-[#3e2723]/6">
      <p className="text-lg font-bold tracking-tight text-[#3e2723]">{value}</p>
      <p className="mt-0.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-[#3e2723]/45">
        {label}
      </p>
    </div>
  );
}

export function HomeJoin({
  signedIn,
  verificationStatus,
  tournamentLabel,
  playerCount,
  teamCount,
}: Props) {
  const verified = verificationStatus === "verified";
  const pending = verificationStatus === "pending";
  const needsProfile =
    signedIn && (verificationStatus === "unverified" || verificationStatus === "rejected");

  return (
    <section className="relative mt-5 space-y-4">
      <div className="grid grid-cols-3 gap-2">
        <Stat
          value={playerCount > 0 ? String(playerCount) : "—"}
          label="Players"
        />
        <Stat value={teamCount > 0 ? String(teamCount) : "—"} label="Teams" />
        <Stat value={tournamentLabel} label="Season" />
      </div>

      {verified ? (
        <div className="overflow-hidden rounded-[1.5rem] bg-[#3e2723] px-5 py-5 text-white shadow-[0_16px_36px_rgba(62,39,35,0.22)]">
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[#f5b830]">
            You&apos;re in the league
          </p>
          <h2 className="mt-1.5 text-[1.45rem] font-bold leading-tight">
            Play {tournamentLabel}
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-white/70">
            Squads are forming. Check the players list and tournaments to stay
            in the game.
          </p>
        </div>
      ) : pending ? (
        <div className="overflow-hidden rounded-[1.5rem] bg-[#3e2723] px-5 py-5 text-white shadow-[0_16px_36px_rgba(62,39,35,0.22)]">
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[#f5b830]">
            Registration submitted
          </p>
          <h2 className="mt-1.5 text-[1.45rem] font-bold leading-tight">
            Verification in review
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-white/70">
            Admin is checking your details. You can view what you sent anytime.
          </p>
          <Link
            href="/verify"
            className="touch-target mt-4 flex w-full items-center justify-center rounded-full bg-[#f5b830] px-5 py-3 text-sm font-bold text-[#3e2723] transition hover:bg-[#ffcf5c] active:scale-[0.98]"
          >
            View registration
          </Link>
        </div>
      ) : (
        <div className="overflow-hidden rounded-[1.5rem] bg-[#3e2723] px-5 py-5 text-white shadow-[0_16px_36px_rgba(62,39,35,0.22)]">
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[#f5b830]">
            Open for new players
          </p>
          <h2 className="mt-1.5 text-[1.45rem] font-bold leading-tight">
            Play {tournamentLabel}
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-white/70">
            Register, get verified, and wait for a captain to pick you. Official
            ID, live scores, and a place in the Ghanchi Premier League.
          </p>
          <Link
            href={needsProfile ? "/verify" : "/register"}
            className="touch-target mt-4 flex w-full items-center justify-center rounded-full bg-[#f5b830] px-5 py-3 text-sm font-bold text-[#3e2723] transition hover:bg-[#ffcf5c] active:scale-[0.98]"
          >
            {needsProfile ? "Complete your player profile" : "Join the league"}
          </Link>
          {signedIn ? null : (
            <p className="mt-3 text-center text-sm text-white/65">
              Already registered?{" "}
              <Link href="/login" className="font-semibold text-[#f5b830]">
                Login
              </Link>
            </p>
          )}
        </div>
      )}

      {signedIn && verified ? null : (
        <div className="rounded-[1.35rem] bg-white/90 p-4 shadow-[0_8px_20px_rgba(62,39,35,0.05)]">
          <h3 className="text-[13px] font-semibold uppercase tracking-[0.14em] text-[#3e2723]/45">
            How to join
          </h3>
          <ol className="mt-3 space-y-3">
            {[
              {
                n: "1",
                title: "Create your account",
                body: "Mobile number and a 4-digit PIN. Takes a minute.",
              },
              {
                n: "2",
                title: "Get verified",
                body: "Upload Aadhaar and lock your playing role.",
              },
              {
                n: "3",
                title: "Get picked",
                body: "Captains invite you. Accept and you’re in a squad.",
              },
            ].map((step) => (
              <li key={step.n} className="flex gap-3">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#f5b830] text-sm font-bold text-[#3e2723]">
                  {step.n}
                </span>
                <div>
                  <p className="text-sm font-semibold text-[#3e2723]">
                    {step.title}
                  </p>
                  <p className="text-[13px] leading-snug text-[#3e2723]/60">
                    {step.body}
                  </p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      )}

      {signedIn && verified ? null : (
        <div className="grid grid-cols-3 gap-2">
          {[
            { icon: <IconIdCard className="h-5 w-5" />, label: "Official ID" },
            { icon: <IconBat className="h-5 w-5" />, label: "Play matches" },
            { icon: <IconTrophy className="h-5 w-5" />, label: "Live scores" },
          ].map((item) => (
            <div
              key={item.label}
              className="flex flex-col items-center gap-1.5 rounded-2xl bg-white/90 px-2 py-3 text-center ring-1 ring-[#3e2723]/6"
            >
              <span className="text-[#1a7f84]">{item.icon}</span>
              <p className="text-[11px] font-semibold text-[#3e2723]">
                {item.label}
              </p>
            </div>
          ))}
        </div>
      )}

      {signedIn ? (
        <div className="grid grid-cols-2 gap-2">
          <Link
            href="/players"
            className="touch-target inline-flex items-center justify-center gap-1.5 rounded-full bg-[#2aa7ad] px-4 py-2.5 text-sm font-semibold text-white"
          >
            <IconTeam className="h-4 w-4" />
            Players
          </Link>
          <Link
            href="/tournaments"
            className="touch-target inline-flex items-center justify-center gap-1.5 rounded-full border border-[#3e2723]/12 bg-white/80 px-4 py-2.5 text-sm font-semibold text-[#3e2723]"
          >
            <IconBadge className="h-4 w-4" />
            Tournaments
          </Link>
        </div>
      ) : null}
    </section>
  );
}
