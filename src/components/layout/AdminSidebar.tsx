"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ADMIN_NAV_ITEMS, APP_SHORT_NAME } from "@/lib/constants";

function isActivePath(href: string, pathname: string) {
  if (href === "/admin") return pathname === "/admin";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function AdminSidebar() {
  const pathname = usePathname() ?? "/admin";

  return (
    <div className="w-full shrink-0 lg:w-56">
      <div className="border-b border-[#3e2723]/10 bg-white/80 px-3 py-2 lg:hidden">
        <div className="flex flex-wrap gap-2">
          {ADMIN_NAV_ITEMS.map((item) => {
            const active = isActivePath(item.href, pathname);
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={`shrink-0 rounded-full border px-3 py-1.5 text-xs font-semibold ${
                  active
                    ? "border-[#1a7f84] bg-[#2aa7ad] text-white"
                    : "border-[#3e2723]/12 bg-[#fdf6e8] text-[#3e2723]"
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </div>
      </div>

      <aside className="hidden border-r border-[#3e2723]/10 bg-white/70 p-4 lg:sticky lg:top-[4.5rem] lg:block lg:self-start">
        <p className="mb-4 text-xs font-semibold uppercase tracking-wider text-[#2aa7ad]">
          {APP_SHORT_NAME} Admin
        </p>
        <nav className="flex flex-col gap-1" aria-label="Admin">
          {ADMIN_NAV_ITEMS.map((item) => {
            const active = isActivePath(item.href, pathname);
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={`rounded-md px-3 py-2 text-sm transition ${
                  active
                    ? "bg-[#2aa7ad]/15 font-semibold text-[#1a7f84]"
                    : "text-[#3e2723]/80 hover:bg-[#2aa7ad]/10 hover:text-[#1a7f84]"
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
      </aside>
    </div>
  );
}
