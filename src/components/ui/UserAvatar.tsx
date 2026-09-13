"use client";

import { useEffect, useState } from "react";

type UserAvatarProps = {
  name: string;
  src?: string | null;
  size?: "sm" | "md" | "lg";
  /** Circle (nav) or rounded square (profile preview so the full photo shows). */
  shape?: "circle" | "rounded";
  /** `contain` shows the full photo; `cover` fills the frame. */
  fit?: "contain" | "cover";
  /** Frame color behind the photo. Inline so it always wins over the default. */
  backgroundColor?: string;
  className?: string;
  /** Set for canvas exports (ID card download). */
  crossOrigin?: "anonymous" | "use-credentials";
};

const SIZE_CLASS = {
  sm: "h-9 w-9 text-[11px]",
  md: "h-12 w-12 text-sm",
  lg: "h-36 w-36 text-2xl sm:h-40 sm:w-40",
} as const;

export function UserAvatar({
  name,
  src,
  size = "sm",
  shape = "circle",
  fit = "cover",
  backgroundColor = "#fdf6e8",
  className = "",
  crossOrigin,
}: UserAvatarProps) {
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    setFailed(false);
  }, [src]);
  const initials = name
    .split(/\s+/)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  const radius = shape === "rounded" ? "rounded-2xl" : "rounded-full";
  const showPhoto = Boolean(src) && !failed;

  return (
    <span
      className={`relative inline-flex shrink-0 items-center justify-center overflow-hidden leading-none ${radius} ${SIZE_CLASS[size]} ${className}`}
      style={{ backgroundColor }}
      aria-hidden={showPhoto ? true : undefined}
    >
      {showPhoto ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src!}
          alt=""
          decoding="async"
          crossOrigin={crossOrigin}
          onError={() => setFailed(true)}
          className={`pointer-events-none absolute inset-0 block max-h-none max-w-none object-[center_18%] ${
            fit === "cover" ? "object-cover" : "object-contain"
          }`}
          style={{ width: "100%", height: "100%" }}
        />
      ) : (
        <span className="font-bold tracking-wide text-[#1a7f84]">{initials}</span>
      )}
    </span>
  );
}
