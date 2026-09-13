import Link from "next/link";
import { formatNrr, type PointsRow } from "@/lib/stats/points";

type PointsTableProps = {
  rows: PointsRow[];
  /** Show only top N rows (e.g. homepage snippet). */
  limit?: number;
  compact?: boolean;
  showLinkToFull?: boolean;
};

export function PointsTable({
  rows,
  limit,
  compact = false,
  showLinkToFull = false,
}: PointsTableProps) {
  const visible = typeof limit === "number" ? rows.slice(0, limit) : rows;

  if (!visible.length) {
    return (
      <div className="rounded-2xl border border-dashed border-[#2aa7ad]/35 bg-white/60 px-5 py-8 text-center">
        <p className="font-medium text-[#3e2723]">No standings yet</p>
        <p className="mt-2 text-sm text-[#3e2723]/60">
          Points appear after league matches are completed.
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-[#3e2723]/10 bg-white shadow-sm">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[520px] text-left text-sm">
          <thead>
            <tr className="border-b border-[#3e2723]/10 bg-[#fdf6e8] text-[11px] font-semibold uppercase tracking-wide text-[#3e2723]/55">
              <th className="px-3 py-2.5 sm:px-4">#</th>
              <th className="px-3 py-2.5 sm:px-4">Team</th>
              {!compact ? (
                <>
                  <th className="px-2 py-2.5 text-center">P</th>
                  <th className="px-2 py-2.5 text-center">W</th>
                  <th className="px-2 py-2.5 text-center">L</th>
                  <th className="px-2 py-2.5 text-center">T</th>
                  <th className="px-2 py-2.5 text-center">NR</th>
                </>
              ) : (
                <th className="px-2 py-2.5 text-center">P</th>
              )}
              <th className="px-2 py-2.5 text-center">Pts</th>
              <th className="px-3 py-2.5 text-right sm:px-4">NRR</th>
            </tr>
          </thead>
          <tbody>
            {visible.map((row, index) => (
              <tr
                key={row.team_id}
                className="border-b border-[#3e2723]/6 last:border-0"
              >
                <td className="px-3 py-2.5 font-medium text-[#3e2723]/45 sm:px-4">
                  {index + 1}
                </td>
                <td className="px-3 py-2.5 sm:px-4">
                  <Link
                    href={`/teams/${row.team_id}`}
                    className="font-semibold text-[#3e2723] hover:text-[#1a7f84]"
                  >
                    <span className="sm:hidden">{row.short_name}</span>
                    <span className="hidden sm:inline">{row.team_name}</span>
                  </Link>
                </td>
                {!compact ? (
                  <>
                    <td className="px-2 py-2.5 text-center text-[#3e2723]/70">
                      {row.played}
                    </td>
                    <td className="px-2 py-2.5 text-center text-[#3e2723]/70">
                      {row.won}
                    </td>
                    <td className="px-2 py-2.5 text-center text-[#3e2723]/70">
                      {row.lost}
                    </td>
                    <td className="px-2 py-2.5 text-center text-[#3e2723]/70">
                      {row.tied}
                    </td>
                    <td className="px-2 py-2.5 text-center text-[#3e2723]/70">
                      {row.nr}
                    </td>
                  </>
                ) : (
                  <td className="px-2 py-2.5 text-center text-[#3e2723]/70">
                    {row.played}
                  </td>
                )}
                <td className="px-2 py-2.5 text-center font-bold text-[#3e2723]">
                  {row.points}
                </td>
                <td className="px-3 py-2.5 text-right tabular-nums text-[#3e2723]/80 sm:px-4">
                  {formatNrr(row.nrr)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {showLinkToFull ? (
        <div className="border-t border-[#3e2723]/8 px-4 py-3">
          <Link
            href="/stats"
            className="text-sm font-semibold text-[#1a7f84] hover:underline"
          >
            Full points table →
          </Link>
        </div>
      ) : null}
    </div>
  );
}
