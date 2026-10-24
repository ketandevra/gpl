import Link from "next/link";
import { getCurrentUser } from "@/lib/auth/session";
import { ProfileClient } from "@/components/auth/ProfileClient";
import { IconLogin } from "@/components/ui/Icons";
import { listTeamsForCaptain } from "@/lib/teams/queries";
import { listPendingInvitesForUser } from "@/lib/teams/invites";
import { adminRest, withRetry } from "@/lib/supabase/rest";
import { isSupabaseAdminConfigured } from "@/lib/supabase/env";
import type { PlayerRole } from "@/lib/types/database";
import type { TshirtSize } from "@/lib/verification/registration";
import { ensureTournamentPlayerForUser } from "@/lib/verification/service";

export const metadata = { title: "Profile" };
export const dynamic = "force-dynamic";

export default async function ProfilePage() {
  const user = await getCurrentUser();

  if (!user) {
    return (
      <div className="page max-w-lg text-center">
        <h1 className="page-title hidden md:block">Profile</h1>
        <p className="mt-2 text-sm text-[#3e2723]/70">
          Sign in to view your account.
        </p>
        <Link
          href="/login?next=/profile"
          className="mt-6 inline-flex touch-target items-center justify-center gap-2 rounded-full bg-[#2aa7ad] px-5 py-3 text-sm font-semibold text-white"
        >
          <IconLogin className="h-4 w-4" />
          Login
        </Link>
      </div>
    );
  }

  const [captainTeams, pendingInvites] = await Promise.all([
    listTeamsForCaptain(user.id),
    listPendingInvitesForUser(user.id),
  ]);

  let playerId: string | null = null;
  let playingRole: PlayerRole | null = null;
  let tshirtSize: TshirtSize | null = null;

  if (isSupabaseAdminConfigured()) {
    const prefs = await withRetry(() =>
      adminRest<
        Array<{
          preferred_player_role: PlayerRole | null;
          tshirt_size: TshirtSize | null;
        }>
      >("users", {
        query: `?id=eq.${encodeURIComponent(user.id)}&select=preferred_player_role,tshirt_size&limit=1`,
      }),
    );
    playingRole = prefs[0]?.preferred_player_role ?? null;
    tshirtSize = prefs[0]?.tshirt_size ?? null;

    if (user.verification_status === "verified") {
      try {
        const ensured = await ensureTournamentPlayerForUser(user.id);
        if (ensured?.public_code) {
          playerId = ensured.public_code;
          playingRole = ensured.role ?? playingRole;
          tshirtSize = (ensured.tshirt_size as TshirtSize | null) ?? tshirtSize;
        }
      } catch (err) {
        console.error("[profile] ensure player failed:", err);
      }
    }

    if (!playerId) {
      const players = await withRetry(() =>
        adminRest<
          Array<{
            public_code: string;
            role: PlayerRole;
            tshirt_size: TshirtSize | null;
          }>
        >("players", {
          query: `?user_id=eq.${encodeURIComponent(user.id)}&select=public_code,role,tshirt_size&order=created_at.desc&limit=1`,
        }),
      );
      const p = players[0];
      if (p) {
        playerId = p.public_code;
        playingRole = p.role ?? playingRole;
        tshirtSize = p.tshirt_size ?? tshirtSize;
      }
    }

    if (!playerId && user.verification_status === "verified") {
      playerId = `GPL-${user.id.replace(/-/g, "").slice(0, 8).toUpperCase()}`;
    }
  }

  return (
    <ProfileClient
      user={user}
      playerId={playerId}
      playingRole={playingRole}
      tshirtSize={tshirtSize}
      captainTeams={captainTeams.map((t) => ({
        id: t.id,
        name: t.name,
        short_name: t.short_name,
        registration_status: t.registration_status,
      }))}
      invites={pendingInvites}
    />
  );
}
