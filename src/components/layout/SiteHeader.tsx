"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { BrandLogo } from "@/components/brand/BrandLogo";
import { useNavigation } from "@/components/layout/NavigationProvider";
import { IconBack } from "@/components/ui/Icons";
import { UserAvatar } from "@/components/ui/UserAvatar";
import { roleLabel, type SessionUser } from "@/lib/auth/permissions";
import { APP_NAME, NAV_ITEMS } from "@/lib/constants";
import { getAppHeader } from "@/lib/navigation/header";

type SiteHeaderProps = {
  hasLive?: boolean;
  user?: SessionUser | null;
  inviteCount?: number;
};

function isNavActive(href: string, pathname: string) {
  if (href === "/") return pathname === "/";
  if (href === "/tournaments") {
    return (
      pathname.startsWith("/tournaments") || pathname.startsWith("/teams")
    );
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function SiteHeader({
  hasLive = true,
  user: userProp = null,
  inviteCount = 0,
}: SiteHeaderProps) {
  const router = useRouter();
  const { displayPath, setPendingPath } = useNavigation();
  const searchParams = useSearchParams();
  const [user, setUser] = useState<SessionUser | null>(userProp);
  const onAdmin = displayPath.startsWith("/admin");
  const navItems = NAV_ITEMS.filter(
    (item) => item.href !== "/live" || hasLive,
  );
  const firstName = user?.name.trim().split(/\s+/)[0] ?? "";
  const displayName = firstName || user?.name || "Account";
  const { title, backHref } = getAppHeader(
    displayPath,
    searchParams.get("from"),
  );

  useEffect(() => {
    if (userProp) {
      setUser(userProp);
      return;
    }
    let cancelled = false;
    void fetch("/api/auth/me", { credentials: "same-origin" })
      .then((res) => res.json())
      .then((data: { user?: SessionUser | null }) => {
        if (!cancelled && data.user) setUser(data.user);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [userProp]);

  const isTabRoot =
    displayPath === "/" ||
    displayPath === "/tournaments" ||
    displayPath === "/players" ||
    displayPath === "/profile";

  function handleBack() {
    if (typeof window !== "undefined" && window.history.length > 1) {
      router.back();
      return;
    }
    if (backHref) {
      setPendingPath(backHref);
      router.push(backHref);
    }
  }

  return (
    <header
      className={`sticky top-0 z-40 shrink-0 text-[#3e2723] md:border-b md:border-[#3e2723]/10 md:bg-[#3e2723]/95 md:text-white md:supports-[backdrop-filter]:bg-[#3e2723]/90 ${
        isTabRoot
          ? "bg-transparent"
          : "border-b border-[#3e2723]/8 bg-[#fdf6e8]/95 pt-[env(safe-area-inset-top)] backdrop-blur-md"
      }`}
    >
      {isTabRoot ? (
        <div className="h-[env(safe-area-inset-top)] md:hidden" />
      ) : (
        <div className="flex h-12 items-center px-1 md:hidden">
          {backHref ? (
            <button
              type="button"
              onClick={handleBack}
              className="inline-flex min-h-11 items-center gap-0.5 rounded-full px-1.5 text-[#1a7f84] active:opacity-70"
            >
              <IconBack />
              <span className="text-[15px] font-semibold tracking-tight text-[#3e2723]">
                {title}
              </span>
            </button>
          ) : (
            <h1 className="px-2.5 text-[15px] font-semibold tracking-tight">
              {title}
            </h1>
          )}
        </div>
      )}

      <div className="mx-auto hidden h-16 max-w-6xl items-center justify-between gap-4 px-4 md:flex">
        <div className="flex min-w-0 items-center gap-3">
          <BrandLogo variant="mark" priority />
          <div className="min-w-0 leading-tight">
            <p className="truncate text-base font-semibold tracking-wide">
              {APP_NAME}
            </p>
            <p className="text-[11px] text-[#f5b830]/90">
              {onAdmin
                ? "Admin console"
                : hasLive
                  ? "Live now · Tournaments · Players"
                  : "Tournaments · Players · Profile"}
            </p>
          </div>
        </div>

        <nav className="hidden items-center gap-0.5 lg:flex" aria-label="Main">
          {navItems.map((item) => {
            const active = isNavActive(item.href, displayPath);
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={`rounded-md px-2.5 py-1.5 text-sm transition hover:bg-white/10 hover:text-white ${
                  item.href === "/live"
                    ? "font-semibold text-[#ff8aab]"
                    : active
                      ? "font-semibold text-white"
                      : "text-white/85"
                }`}
              >
                {item.label}
                {item.href === "/live" ? (
                  <span className="ml-1.5 inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-[#d81b60]" />
                ) : null}
              </Link>
            );
          })}
          {user?.role === "admin" ? (
            <Link
              href="/admin"
              aria-current={onAdmin ? "page" : undefined}
              className={`rounded-md px-2.5 py-1.5 text-sm font-semibold transition hover:bg-white/10 ${
                onAdmin
                  ? "bg-[#f5b830] text-[#3e2723]"
                  : "text-[#f5b830]"
              }`}
            >
              Admin
            </Link>
          ) : null}
        </nav>

        <div className="flex shrink-0 items-center gap-2">
          {hasLive ? (
            <Link
              href="/live"
              className="touch-target inline-flex items-center justify-center gap-1.5 rounded-full bg-[#d81b60] px-3 py-2 text-xs font-bold uppercase tracking-wide text-white lg:hidden"
            >
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-white" />
              Live
            </Link>
          ) : null}
          {user ? (
            <Link
              href="/profile"
              className="touch-target relative inline-flex max-w-[14rem] items-center gap-2 rounded-full bg-[#f5b830]/95 py-1 pl-1 pr-3 text-[#3e2723] transition hover:bg-[#ffcf5c] active:scale-[0.98]"
            >
              <span className="relative">
                <UserAvatar
                  name={user.name}
                  src={user.avatar_url}
                  size="sm"
                  className="ring-2 ring-white/80"
                />
                {inviteCount > 0 ? (
                  <span className="absolute -right-1 -top-1 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-[#d81b60] px-1 text-[10px] font-bold text-white">
                    {inviteCount > 9 ? "9+" : inviteCount}
                  </span>
                ) : null}
              </span>
              <span className="min-w-0 leading-tight">
                <span className="block truncate text-sm font-semibold">
                  {displayName}
                </span>
                {user.role === "admin" ? (
                  <span className="block text-[10px] font-bold uppercase tracking-wide text-[#1a7f84]">
                    {roleLabel(user.role)}
                  </span>
                ) : null}
              </span>
            </Link>
          ) : (
            <Link
              href="/login"
              className="touch-target inline-flex items-center justify-center rounded-full bg-[#f5b830] px-3.5 py-2 text-sm font-semibold text-[#3e2723] transition hover:bg-[#ffcf5c] active:scale-[0.98]"
            >
              Login
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
