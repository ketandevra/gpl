"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { MOBILE_NAV_ITEMS } from "@/lib/constants";

function NavIcon({ name, active }: { name: string; active: boolean }) {
  const stroke = active ? "#1a7f84" : "#7a6a5c";
  const common = {
    width: 22,
    height: 22,
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
    case "live":
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="3" fill={active ? "#d81b60" : "none"} />
          <path d="M5.5 5.5a9 9 0 0 1 0 13" />
          <path d="M18.5 5.5a9 9 0 0 0 0 13" />
        </svg>
      );
    case "matches":
      return (
        <svg {...common}>
          <rect x="3" y="4" width="18" height="16" rx="2" />
          <path d="M3 9h18M8 4v16" />
        </svg>
      );
    case "teams":
      return (
        <svg {...common}>
          <circle cx="9" cy="8" r="3" />
          <circle cx="16" cy="9" r="2.5" />
          <path d="M3 19c1.5-3 4-4.5 6-4.5S13.5 16 15 19" />
          <path d="M14 14.5c1.4 0 3.2.8 4.5 4.5" />
        </svg>
      );
    case "stats":
      return (
        <svg {...common}>
          <path d="M4 19V9M10 19V5M16 19v-7M22 19H2" />
        </svg>
      );
    default:
      return null;
  }
}

type MobileNavigationProps = {
  hasLive?: boolean;
};

export function MobileNavigation({ hasLive = false }: MobileNavigationProps) {
  const pathname = usePathname();
  if (pathname.startsWith("/admin")) return null;
  const items = MOBILE_NAV_ITEMS.filter(
    (item) => item.href !== "/live" || hasLive,
  );
  const cols = items.length >= 5 ? "grid-cols-5" : "grid-cols-4";

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-40 border-t border-[#3e2723]/10 bg-[#fdf6e8]/95 pb-[env(safe-area-inset-bottom)] shadow-[0_-4px_20px_rgba(62,39,35,0.08)] backdrop-blur-md md:hidden"
      aria-label="Mobile"
    >
      <ul className={`mx-auto grid max-w-lg ${cols} gap-0.5 px-1 pt-1.5 pb-1`}>
        {items.map((item) => {
          const active =
            item.href === "/"
              ? pathname === "/"
              : pathname.startsWith(item.href);

          return (
            <li key={item.href}>
              <Link
                href={item.href}
                className={`relative flex min-h-[52px] flex-col items-center justify-center gap-0.5 rounded-xl px-1 py-1.5 text-[10px] font-semibold tracking-wide transition active:scale-[0.97] ${
                  active
                    ? "bg-[#2aa7ad]/12 text-[#1a7f84]"
                    : "text-[#7a6a5c] hover:text-[#3e2723]"
                }`}
              >
                <span className="relative inline-flex">
                  <NavIcon name={item.icon} active={active} />
                  {item.href === "/live" && hasLive ? (
                    <span className="absolute -right-0.5 -top-0.5 h-1.5 w-1.5 animate-pulse rounded-full bg-[#d81b60]" />
                  ) : null}
                </span>
                <span>{item.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
