"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function GuestLoginButton() {
  const pathname = usePathname();
  if (
    pathname === "/" ||
    pathname.startsWith("/login") ||
    pathname.startsWith("/register")
  ) {
    return null;
  }

  return (
    <Link
      href="/login"
      className="touch-target fixed bottom-[max(1.25rem,calc(env(safe-area-inset-bottom)+0.75rem))] left-1/2 z-40 inline-flex -translate-x-1/2 items-center justify-center rounded-full bg-[#f5b830] px-7 py-3 text-sm font-bold text-[#3e2723] shadow-[0_10px_28px_rgba(62,39,35,0.22)] transition hover:bg-[#ffcf5c] active:scale-[0.98]"
    >
      Login
    </Link>
  );
}
