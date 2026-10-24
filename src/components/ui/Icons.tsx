type IconProps = {
  className?: string;
};

const base = {
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.8,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  "aria-hidden": true as const,
};

export function IconPhone({ className = "h-4 w-4" }: IconProps) {
  return (
    <svg {...base} className={className}>
      <rect x="7" y="2.5" width="10" height="19" rx="2" />
      <path d="M11 18.5h2" />
    </svg>
  );
}

export function IconBat({ className = "h-4 w-4" }: IconProps) {
  return (
    <svg {...base} className={className}>
      <path d="m6 18 9.2-9.2a2.4 2.4 0 0 0 0-3.4l-.6-.6a2.4 2.4 0 0 0-3.4 0L5 11.8" />
      <path d="M5 19c1.8.4 3.2-.4 4-2" />
      <path d="m14.2 6.2 3.6 3.6" />
    </svg>
  );
}

export function IconShirt({ className = "h-4 w-4" }: IconProps) {
  return (
    <svg {...base} className={className}>
      <path d="M8 5.5 12 8l4-2.5 3 2.5-2 3V20H7V8.5L5 5.5 8 3z" />
    </svg>
  );
}

export function IconShield({ className = "h-4 w-4" }: IconProps) {
  return (
    <svg {...base} className={className}>
      <path d="M12 3.5 19 6v6.2c0 4.2-2.8 7.4-7 8.3-4.2-.9-7-4.1-7-8.3V6z" />
    </svg>
  );
}

export function IconBadge({ className = "h-4 w-4" }: IconProps) {
  return (
    <svg {...base} className={className}>
      <circle cx="12" cy="12" r="8" />
      <path d="m8.5 12.2 2.3 2.3 4.7-5" />
    </svg>
  );
}

export function IconIdCard({ className = "h-4 w-4" }: IconProps) {
  return (
    <svg {...base} className={className}>
      <rect x="3" y="6" width="18" height="12" rx="2" />
      <circle cx="8.5" cy="12" r="1.8" />
      <path d="M12.5 10.5h5M12.5 13.5h4" />
    </svg>
  );
}

export function IconTeam({ className = "h-4 w-4" }: IconProps) {
  return (
    <svg {...base} className={className}>
      <circle cx="9" cy="8" r="2.4" />
      <circle cx="16" cy="9" r="2" />
      <path d="M3.8 18c.8-3 3-4.6 5.2-4.6S13.4 15 14.2 18" />
      <path d="M14 13.6c1.6-.2 3.2.6 4.2 2.4" />
    </svg>
  );
}

export function IconLogout({ className = "h-4 w-4" }: IconProps) {
  return (
    <svg {...base} className={className}>
      <path d="M10 7V5.5A1.5 1.5 0 0 1 11.5 4h7A1.5 1.5 0 0 1 20 5.5v13a1.5 1.5 0 0 1-1.5 1.5h-7A1.5 1.5 0 0 1 10 18.5V17" />
      <path d="M14 12H4" />
      <path d="m7 9-3 3 3 3" />
    </svg>
  );
}

export function IconAdmin({ className = "h-4 w-4" }: IconProps) {
  return (
    <svg {...base} className={className}>
      <circle cx="12" cy="8" r="3" />
      <path d="M5 19.2C6.4 16 8.8 14.5 12 14.5s5.6 1.5 7 4.7" />
      <path d="M17.5 7.5 19 6l.8 1.8L21.5 8.5 20 10l.3 2-1.8-.7L17 13l.2-2L16 9.5z" />
    </svg>
  );
}

export function IconScore({ className = "h-4 w-4" }: IconProps) {
  return (
    <svg {...base} className={className}>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7.5v5l3 1.8" />
    </svg>
  );
}

export function IconInvite({ className = "h-4 w-4" }: IconProps) {
  return (
    <svg {...base} className={className}>
      <path d="M4 7.5 12 13l8-5.5" />
      <rect x="4" y="6" width="16" height="12" rx="2" />
    </svg>
  );
}

export function IconChevron({ className = "h-4 w-4" }: IconProps) {
  return (
    <svg {...base} className={className}>
      <path d="m9 6 6 6-6 6" />
    </svg>
  );
}

export function IconBack({ className = "h-5 w-5" }: IconProps) {
  return (
    <svg {...base} className={className}>
      <path d="M15 5 8 12l7 7" />
    </svg>
  );
}

export function IconTrophy({ className = "h-4 w-4" }: IconProps) {
  return (
    <svg {...base} className={className}>
      <path d="M8 4h8v3a4 4 0 0 1-8 0V4Z" />
      <path d="M8 6H5a3 3 0 0 0 3 3" />
      <path d="M16 6h3a3 3 0 0 1-3 3" />
      <path d="M12 13v3" />
      <path d="M9 20h6" />
      <path d="M10 17h4" />
    </svg>
  );
}

export function IconSearch({ className = "h-4 w-4" }: IconProps) {
  return (
    <svg {...base} className={className}>
      <circle cx="11" cy="11" r="6.5" />
      <path d="m16 16 4 4" />
    </svg>
  );
}

export function IconLogin({ className = "h-4 w-4" }: IconProps) {
  return (
    <svg {...base} className={className}>
      <path d="M14 7V5.5A1.5 1.5 0 0 0 12.5 4h-7A1.5 1.5 0 0 0 4 5.5v13A1.5 1.5 0 0 0 5.5 20h7a1.5 1.5 0 0 0 1.5-1.5V17" />
      <path d="M10 12h10" />
      <path d="m17 9 3 3-3 3" />
    </svg>
  );
}

export function IconClock({ className = "h-4 w-4" }: IconProps) {
  return (
    <svg {...base} className={className}>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 8v4.2L15 15" />
    </svg>
  );
}

export function IconCalendar({ className = "h-4 w-4" }: IconProps) {
  return (
    <svg {...base} className={className}>
      <rect x="3.5" y="5" width="17" height="15.5" rx="2" />
      <path d="M3.5 10h17" />
      <path d="M8 3.5v3" />
      <path d="M16 3.5v3" />
    </svg>
  );
}
