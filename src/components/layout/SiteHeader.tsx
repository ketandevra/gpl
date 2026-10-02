"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BrandLogo } from "@/components/brand/BrandLogo";
import { UserAvatar } from "@/components/ui/UserAvatar";
import { roleLabel, type SessionUser } from "@/lib/auth/permissions";
import { APP_NAME, NAV_ITEMS } from "@/lib/constants";

type SiteHeaderProps = {
  hasLive?: boolean;
  user?: SessionUser | null;
  inviteCount?: number;
};

function isNavActive(href: string, pathname: string) {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function SiteHeader({
  hasLive = false,
  user = null,
  inviteCount = 0,
}: SiteHeaderProps) {
  const pathname = usePathname() ?? "/";
  const onAdmin = pathname.startsWith("/admin");
  const navItems = NAV_ITEMS.filter(
    (item) => item.href !== "/live" || hasLive,
  );
  const firstName = user?.name.trim().split(/\s+/)[0] ?? "";
  const displayName = firstName || user?.name || "Account";

  return (
    <header className="sticky top-0 z-40 border-b border-[#3e2723]/10 bg-[#3e2723]/95 text-white backdrop-blur-md supports-[backdrop-filter]:bg-[#3e2723]/90">
      <div className="flex h-14 items-center px-3 md:hidden">
        <BrandLogo variant="mark" priority />
        <p className="min-w-0 flex-1 px-2 text-center text-sm font-semibold leading-tight tracking-wide">
          {APP_NAME}
        </p>
        <span className="pointer-events-none invisible" aria-hidden>
          <BrandLogo variant="mark" href={null} />
        </span>
      </div>

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
                  ? "Live now · Teams · Players"
                  : "Teams · Players · Profile"}
            </p>
          </div>
        </div>

        <nav className="hidden items-center gap-0.5 lg:flex" aria-label="Main">
          {navItems.map((item) => {
            const active = isNavActive(item.href, pathname);
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
