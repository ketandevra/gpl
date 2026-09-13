import Link from "next/link";
import type { ReactNode } from "react";

type BackLinkProps = {
  href: string;
  children: ReactNode;
  className?: string;
};

export function BackLink({ href, children, className = "" }: BackLinkProps) {
  return (
    <Link
      href={href}
      className={`inline-flex items-center gap-1.5 text-sm font-semibold leading-none text-[#1a7f84] hover:underline ${className}`}
    >
      <span className="text-[15px] leading-none" aria-hidden>
        ←
      </span>
      <span className="leading-none">{children}</span>
    </Link>
  );
}
