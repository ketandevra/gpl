type Props = {
  className?: string;
};

export function VerifiedBadge({ className = "" }: Props) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full bg-[#e8f8ee] px-2.5 py-1 text-xs font-semibold text-[#166534] ${className}`}
    >
      <svg width="14" height="14" viewBox="0 0 24 24" aria-hidden>
        <circle cx="12" cy="12" r="10" fill="#22c55e" />
        <path
          d="M8.1 12.2 10.7 14.7 15.9 9.3"
          fill="none"
          stroke="white"
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      Verified player
    </span>
  );
}
