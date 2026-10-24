export function publicCodeNumber(code: string): number {
  const match = /^P(\d+)$/i.exec(code);
  return match ? Number(match[1]) : NaN;
}

export function formatPublicCode(n: number): string {
  return `P${String(n).padStart(3, "0")}`;
}

export function nextPublicCodeFrom(codes: string[]): string {
  let max = 0;
  for (const code of codes) {
    const n = publicCodeNumber(code);
    if (Number.isFinite(n)) max = Math.max(max, n);
  }
  return formatPublicCode(max + 1);
}

export function pickCanonicalPublicCode(
  rows: Array<{
    public_code: string;
    tournament_id: string;
    created_at?: string;
  }>,
  activeTournamentId?: string | null,
): string | null {
  if (!rows.length) return null;
  const unique = [...new Set(rows.map((row) => row.public_code))];
  if (unique.length === 1) return unique[0] ?? null;
  const inActive = activeTournamentId
    ? rows.find((row) => row.tournament_id === activeTournamentId)
    : undefined;
  if (inActive) return inActive.public_code;
  const sorted = [...rows].sort((a, b) =>
    (a.created_at ?? "").localeCompare(b.created_at ?? ""),
  );
  return sorted[0]?.public_code ?? null;
}
