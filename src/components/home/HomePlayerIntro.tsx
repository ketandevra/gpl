"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { playerRoleLabel } from "@/lib/teams/labels";
import type { ShowcasePlayer } from "@/lib/teams/queries";

const HOLD_MS = 4200;

type Props = {
  tournamentLabel: string;
  players: ShowcasePlayer[];
};

function initials(name: string) {
  return name
    .split(/\s+/)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function shuffle<T>(items: T[]): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function shuffleDeck(players: ShowcasePlayer[], avoidId?: string) {
  const deck = shuffle(players);
  if (deck.length > 1 && avoidId && deck[0]?.id === avoidId) {
    const swapAt = deck.findIndex((row) => row.id !== avoidId);
    if (swapAt > 0) {
      [deck[0], deck[swapAt]] = [deck[swapAt], deck[0]];
    }
  }
  return deck;
}

function playerKey(players: ShowcasePlayer[]) {
  return players
    .map((row) => row.id)
    .sort()
    .join("|");
}

export function HomePlayerIntro({
  tournamentLabel,
  players,
}: Props) {
  const [deck, setDeck] = useState(players);
  const [index, setIndex] = useState(0);
  const touchX = useRef<number | null>(null);
  const swiped = useRef(false);
  const ids = playerKey(players);
  const player = deck[index] ?? players[0];

  useEffect(() => {
    setDeck(shuffleDeck(players));
    setIndex(0);
  }, [ids]);

  useEffect(() => {
    if (deck.length < 2) return;
    const timer = window.setTimeout(() => {
      if (index >= deck.length - 1) {
        setDeck(shuffleDeck(deck, deck[index]?.id));
        setIndex(0);
        return;
      }
      setIndex(index + 1);
    }, HOLD_MS);
    return () => window.clearTimeout(timer);
  }, [deck, index]);

  if (!player) return null;

  function go(next: number) {
    const total = deck.length;
    if (total < 1) return;
    if (next >= total) {
      setDeck(shuffleDeck(deck, deck[index]?.id));
      setIndex(0);
      return;
    }
    if (next < 0) {
      setIndex(total - 1);
      return;
    }
    setIndex(next);
  }

  return (
    <section className="flex min-h-0 flex-1 flex-col">
      <Link
        href={`/players/${player.id}`}
        className="relative block aspect-[4/5] min-h-[58dvh] w-full overflow-hidden rounded-[1.75rem] border border-[#3e2723]/10 bg-[#3e2723] shadow-[0_18px_40px_rgba(62,39,35,0.28)] [touch-action:pan-y]"
        onClick={(event) => {
          if (!swiped.current) return;
          event.preventDefault();
          swiped.current = false;
        }}
        onTouchStart={(event) => {
          touchX.current = event.changedTouches[0]?.clientX ?? null;
        }}
        onTouchEnd={(event) => {
          const start = touchX.current;
          touchX.current = null;
          if (start == null) return;
          const delta = (event.changedTouches[0]?.clientX ?? start) - start;
          if (Math.abs(delta) < 40) return;
          swiped.current = true;
          go(delta < 0 ? index + 1 : index - 1);
        }}
      >
        <article key={`${player.id}-${index}`} className="absolute inset-0">
          {player.avatar_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={player.avatar_url}
              alt=""
              className="gpl-intro-photo absolute inset-0 h-full w-full object-cover object-[center_18%]"
            />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center bg-[#2aa7ad]/20 text-5xl font-bold text-[#f5b830]">
              {initials(player.name)}
            </div>
          )}
          <div
            className="absolute inset-0 bg-gradient-to-t from-[#3e2723] via-[#3e2723]/35 to-transparent"
            aria-hidden
          />
          <div className="absolute inset-x-0 bottom-0 px-5 pb-5 pt-20">
            <p className="gpl-intro-kicker text-[11px] font-semibold uppercase tracking-[0.22em] text-[#f5b830]">
              Introducing · {tournamentLabel}
            </p>
            <h3 className="gpl-intro-name mt-1.5 text-[1.85rem] font-bold leading-tight text-white sm:text-4xl">
              {player.name}
            </h3>
            <p className="gpl-intro-meta mt-1.5 text-sm font-medium text-[#fdf6e8]/80">
              {playerRoleLabel(player.role)} · {player.public_code}
            </p>
            <div className="mt-5 h-0.5 overflow-hidden rounded-full bg-white/20">
              <div
                key={`${player.id}-${index}-bar`}
                className="gpl-intro-bar h-full rounded-full bg-[#f5b830]"
              />
            </div>
          </div>
        </article>
      </Link>
    </section>
  );
}
