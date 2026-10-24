"use client";

import { useEffect, useState } from "react";
import {
  IconCalendar,
  IconClock,
  IconTeam,
  IconTrophy,
} from "@/components/ui/Icons";
import {
  TEAM_ENTRY_DEADLINE_ISO,
  TEAM_ENTRY_DEADLINE_LABEL,
} from "@/lib/constants";

const DEADLINE_MS = new Date(TEAM_ENTRY_DEADLINE_ISO).getTime();

function split(ms: number) {
  const total = Math.max(0, Math.floor(ms / 1000));
  const days = Math.floor(total / 86400);
  const hours = Math.floor((total % 86400) / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;
  return { days, hours, minutes, seconds };
}

function pad(value: number) {
  return String(value).padStart(2, "0");
}

function Unit({
  value,
  label,
  pulse,
}: {
  value: string;
  label: string;
  pulse?: boolean;
}) {
  return (
    <div
      className={`relative rounded-2xl bg-[#2a1b18] px-1 py-2.5 text-center ring-1 ${
        pulse ? "ring-[#f5b830]/50" : "ring-white/10"
      }`}
    >
      {pulse ? (
        <span
          key={`ring-${value}`}
          className="gpl-count-ring pointer-events-none absolute inset-0 rounded-2xl"
          aria-hidden
        />
      ) : null}
      <div
        className="pointer-events-none absolute inset-x-3 top-0 h-px bg-gradient-to-r from-transparent via-[#f5b830] to-transparent"
        aria-hidden
      />
      <p
        key={`num-${value}`}
        className="gpl-count-flip text-[1.35rem] font-bold tabular-nums leading-none tracking-tight text-white sm:text-2xl"
      >
        {value}
      </p>
      <p className="mt-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-[#f5b830]/80">
        {label}
      </p>
    </div>
  );
}

export function HomeCountdown() {
  const [msLeft, setMsLeft] = useState<number | null>(null);

  useEffect(() => {
    function tick() {
      setMsLeft(DEADLINE_MS - Date.now());
    }
    tick();
    const timer = window.setInterval(tick, 1000);
    return () => window.clearInterval(timer);
  }, []);

  const closed = msLeft !== null && msLeft <= 0;
  const parts = split(msLeft ?? 0);
  const ready = msLeft != null;

  return (
    <section className="relative overflow-hidden rounded-[1.5rem] bg-[#3e2723] px-4 py-4 text-white shadow-[0_16px_36px_rgba(62,39,35,0.22)]">
      <div
        className="gpl-count-glow pointer-events-none absolute -right-10 -top-12 h-36 w-36 rounded-full bg-[#f5b830]/40 blur-3xl"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute -bottom-14 -left-10 h-32 w-32 rounded-full bg-[#2aa7ad]/28 blur-3xl"
        aria-hidden
      />

      <div className="relative flex items-center justify-between gap-2">
        <p className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.18em] text-[#f5b830]">
          {closed ? (
            <IconTrophy className="h-3.5 w-3.5" />
          ) : (
            <span className="relative inline-flex h-2 w-2">
              <span className="gpl-count-live absolute inset-0 rounded-full bg-[#f5b830]" />
              <span className="relative h-2 w-2 rounded-full bg-[#f5b830]" />
            </span>
          )}
          {closed ? "Entries closed" : "Closing soon"}
        </p>
        <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-[#f5b830]/15 text-[#f5b830] ring-1 ring-[#f5b830]/25">
          <IconClock className="h-4 w-4" />
        </span>
      </div>

      <div className="relative mt-2.5 flex items-start gap-2.5">
        <span className="mt-0.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#2aa7ad]/20 text-[#7ee0e4]">
          <IconTeam className="h-4 w-4" />
        </span>
        <div className="min-w-0">
          <h2 className="text-[1.2rem] font-bold leading-tight">
            Team & entry fees
          </h2>
          <p className="mt-1 inline-flex items-center gap-1.5 text-sm text-white/70">
            <IconCalendar className="h-3.5 w-3.5 text-[#f5b830]" />
            {TEAM_ENTRY_DEADLINE_LABEL}
          </p>
        </div>
      </div>

      {closed ? (
        <p className="relative mt-3 rounded-2xl bg-white/8 px-3 py-2.5 text-sm font-semibold text-[#f5b830] ring-1 ring-white/8">
          Team submission and entry fees are now closed.
        </p>
      ) : (
        <div className="relative mt-3.5 grid grid-cols-4 gap-1.5">
          <Unit value={ready ? pad(parts.days) : "--"} label="Days" />
          <Unit value={ready ? pad(parts.hours) : "--"} label="Hrs" />
          <Unit value={ready ? pad(parts.minutes) : "--"} label="Min" />
          <Unit
            value={ready ? pad(parts.seconds) : "--"}
            label="Sec"
            pulse={ready}
          />
        </div>
      )}
    </section>
  );
}
