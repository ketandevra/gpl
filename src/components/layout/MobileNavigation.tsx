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
    case "teams":
      return (
        <svg {...common}>
          <circle cx="9" cy="8" r="3" />
          <circle cx="16" cy="9" r="2.5" />
          <path d="M3 19c1.5-3 4-4.5 6-4.5S13.5 16 15 19" />
          <path d="M14 14.5c1.4 0 3.2.8 4.5 4.5" />
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
  const pathname = usePathname();
  if (pathname.startsWith("/admin")) return null;

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-40 border-t border-[#3e2723]/10 bg-[#fdf6e8]/95 pb-[env(safe-area-inset-bottom)] shadow-[0_-4px_20px_rgba(62,39,35,0.08)] backdrop-blur-md md:hidden"
      aria-label="Mobile"
    >
      <ul className="mx-auto grid max-w-lg grid-cols-4 gap-0.5 px-1 pt-1.5 pb-1">
        {MOBILE_NAV_ITEMS.map((item) => {
          const active =
            item.href === "/"
              ? pathname === "/"
              : item.href === "/profile"
                ? pathname.startsWith("/profile") ||
                  pathname.startsWith("/login") ||
                  pathname.startsWith("/register")
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
