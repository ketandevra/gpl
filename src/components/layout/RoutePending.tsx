"use client";

import type { ReactNode } from "react";
import { usePathname } from "next/navigation";
import { useNavigation } from "@/components/layout/NavigationProvider";

export function PlayerDetailSkeleton() {
  return (
    <div className="mx-auto max-w-lg animate-pulse overflow-x-hidden px-3 pb-6 pt-2">
      <div className="overflow-hidden rounded-[1.75rem] bg-[#3e2723]">
        <div className="aspect-[4/5] min-h-[22rem] bg-[#3e2723]" />
      </div>
      <div className="mt-4 h-36 rounded-[1.35rem] bg-white/90" />
      <div className="mt-3 h-24 rounded-[1.35rem] bg-white/80" />
    </div>
  );
}

function GenericSkeleton() {
  return (
    <div className="page max-w-6xl animate-pulse">
      <div className="h-4 w-28 rounded-full bg-[#3e2723]/8" />
      <div className="mt-4 space-y-3">
        <div className="h-20 rounded-2xl bg-white/80 shadow-sm" />
        <div className="h-20 rounded-2xl bg-white/80 shadow-sm" />
        <div className="h-20 rounded-2xl bg-white/80 shadow-sm" />
      </div>
    </div>
  );
}

export function RoutePending({ children }: { children: ReactNode }) {
  const pathname = usePathname() ?? "/";
  const { pendingPath } = useNavigation();
  const pending = Boolean(pendingPath && pendingPath !== pathname);
  const playerPending =
    pending &&
    pendingPath != null &&
    pendingPath.startsWith("/players/") &&
    pendingPath !== "/players";

  return (
    <div className="relative h-full">
      <div className={pending ? "invisible h-full" : "h-full"}>{children}</div>
      {pending ? (
        <div className="absolute inset-0 overflow-y-auto bg-[#fdf6e8]">
          {playerPending ? <PlayerDetailSkeleton /> : <GenericSkeleton />}
        </div>
      ) : null}
    </div>
  );
}
