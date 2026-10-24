"use client";

import Link from "next/link";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useNavigation } from "@/components/layout/NavigationProvider";
import { MOBILE_NAV_ITEMS } from "@/lib/constants";

function NavIcon({ name, active }: { name: string; active: boolean }) {
  const stroke = active ? "#1a7f84" : "#7a6a5c";
  const common = {
    width: 20,
    height: 20,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke,
    strokeWidth: 2,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true as const,
  };

  switch (name) {
    case "home":
      return (
        <svg {...common}>
          <path d="M3 10.5 12 3l9 7.5" />
          <path d="M5 10v10h14V10" />
        </svg>
      );
    case "tournament":
      return (
        <svg {...common}>
          <path d="M8 4h8v3a4 4 0 0 1-8 0V4Z" />
          <path d="M8 6H5a3 3 0 0 0 3 3" />
          <path d="M16 6h3a3 3 0 0 1-3 3" />
          <path d="M12 13v3" />
          <path d="M9 20h6" />
          <path d="M10 17h4" />
        </svg>
      );
    case "players":
      return (
        <svg {...common}>
          <circle cx="12" cy="8" r="3.5" />
          <path d="M5 20c1.2-4 4-6 7-6s5.8 2 7 6" />
        </svg>
      );
    case "profile":
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="9" />
          <circle cx="12" cy="10" r="3" />
          <path d="M6.5 18.2c1.4-2.2 3.3-3.2 5.5-3.2s4.1 1 5.5 3.2" />
        </svg>
      );
    default:
      return null;
  }
}

export function MobileNavigation() {
  const router = useRouter();
  const { displayPath, setPendingPath } = useNavigation();
  useEffect(() => {
    for (const item of MOBILE_NAV_ITEMS) {
      router.prefetch(item.href);
    }
  }, [router]);
  if (displayPath.startsWith("/admin")) return null;

  return (
    <nav
      className="app-tabbar z-40 shrink-0 border-t border-[#3e2723]/10 bg-[#fdf6e8] md:hidden"
      aria-label="Mobile"
    >
      <ul className="mx-auto grid max-w-lg grid-cols-4 px-1">
        {MOBILE_NAV_ITEMS.map((item) => {
          const active =
            item.href === "/"
              ? displayPath === "/"
              : item.href === "/profile"
                ? displayPath.startsWith("/profile") ||
                  displayPath.startsWith("/login") ||
                  displayPath.startsWith("/register")
                : item.href === "/tournaments"
                  ? displayPath.startsWith("/tournaments") ||
                    displayPath.startsWith("/teams")
                  : displayPath.startsWith(item.href);

          return (
            <li key={item.href}>
              <Link
                href={item.href}
                prefetch
                onClick={() => setPendingPath(item.href)}
                className={`relative flex h-12 flex-col items-center justify-center gap-0.5 px-1 text-[10px] font-semibold tracking-wide transition active:scale-[0.97] ${
                  active
                    ? "bg-[#2aa7ad]/12 text-[#1a7f84]"
                    : "text-[#7a6a5c] hover:text-[#3e2723]"
                }`}
              >
                <NavIcon name={item.icon} active={active} />
                <span>{item.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
