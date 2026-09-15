"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  PlayerSearchPicker,
  type PickerPlayer,
} from "@/components/teams/PlayerSearchPicker";
import { formatPlayerLabel } from "@/lib/teams/labels";
import type { TeamInviteView, TeamPlayerView } from "@/lib/teams/types";

type Props = {
  teamId: string;
  initialPlayers: TeamPlayerView[];
  initialInvites: TeamInviteView[];
  canEdit: boolean;
  approved: boolean;
  squadSize: number;
  adminOverride?: boolean;
  compact?: boolean;
  onRosterChange?: (players: TeamPlayerView[]) => void;
};

export function ManageSquadClient({
  teamId,
  initialPlayers,
  initialInvites,
  canEdit,
  approved,
  squadSize,
  adminOverride = false,
  compact = false,
  onRosterChange,
}: Props) {
  const router = useRouter();
  const [players, setPlayers] = useState(initialPlayers);
  const [invites, setInvites] = useState(initialInvites);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setPlayers(initialPlayers);
    setInvites(initialInvites);
  }, [initialPlayers, initialInvites]);

  if (!canEdit) return null;

  const occupied = adminOverride
    ? players.length
    : players.length + invites.length;
  const spotsLeft = squadSize - occupied;
  const isFull = occupied >= squadSize;
  const canChangeRoster = !approved || adminOverride;
  const blockedIds = adminOverride
    ? players.map((p) => p.id)
    : [
        ...players.map((p) => p.id),
        ...invites.map((i) => i.player_id),
      ];

  async function invitePlayer(player: PickerPlayer) {
    if (isFull) {
      setError(`Squad is full (${squadSize}/${squadSize}).`);
      return;
    }
    if (players.some((p) => p.id === player.id)) {
      setError("This player is already on the squad.");
      return;
    }
    if (invites.some((i) => i.player_id === player.id) && !adminOverride) {
      setError("An invite is already waiting for this player.");
      return;
    }
    if (player.availability.status === "locked") {
      setError(
        `Cannot invite ${formatPlayerLabel(player)} — already in an approved team.`,
      );
      return;
    }
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch(`/api/teams/${teamId}/players`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ player_id: player.id }),
      });
      const data = (await res.json()) as {
        error?: string;
        auto_joined?: boolean;
        players?: TeamPlayerView[];
        invites?: TeamInviteView[];
      };
      if (!res.ok) {
        setError(data.error ?? (adminOverride ? "Could not add player." : "Could not send invite."));
        return;
      }
      if (data.players) {
        setPlayers(data.players);
        onRosterChange?.(data.players);
      }
      if (data.invites) setInvites(data.invites);
      setMessage(
        data.auto_joined
          ? `Added ${formatPlayerLabel(player)} to the squad.`
          : `Invite sent to ${formatPlayerLabel(player)}. They join only after accepting.`,
      );
      router.refresh();
    } catch {
      setError("Network error.");
    } finally {
      setBusy(false);
    }
  }

  async function removePlayer(playerId: string) {
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch(`/api/teams/${teamId}/players`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ player_id: playerId }),
      });
      const data = (await res.json()) as {
        error?: string;
        players?: TeamPlayerView[];
        invites?: TeamInviteView[];
      };
      if (!res.ok) {
        setError(data.error ?? "Could not remove player.");
        return;
      }
      const nextPlayers = data.players ?? [];
      setPlayers(nextPlayers);
      onRosterChange?.(nextPlayers);
      if (data.invites) setInvites(data.invites);
      setMessage("Player removed.");
      router.refresh();
    } catch {
      setError("Network error.");
    } finally {
      setBusy(false);
    }
  }

  async function withdrawInvite(inviteId: string) {
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch(`/api/teams/${teamId}/players`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ invite_id: inviteId }),
      });
      const data = (await res.json()) as {
        error?: string;
        players?: TeamPlayerView[];
        invites?: TeamInviteView[];
      };
      if (!res.ok) {
        setError(data.error ?? "Could not withdraw invite.");
        return;
      }
      if (data.players) setPlayers(data.players);
      setInvites(data.invites ?? []);
      setMessage("Invite withdrawn.");
      router.refresh();
    } catch {
      setError("Network error.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section
      className={`${compact ? "mt-4" : "mt-8"} rounded-2xl border border-[#3e2723]/10 bg-white p-5 shadow-sm`}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-semibold text-[#3e2723]">Manage squad</h2>
        <p className="text-sm font-semibold text-[#1a7f84]">
          {players.length} accepted
          {invites.length ? ` · ${invites.length} pending` : ""} / {squadSize}
        </p>
      </div>
      <p className="mt-1 text-sm text-[#3e2723]/60">
        {adminOverride
          ? `Add or remove verified players. They join the squad immediately. ${
              spotsLeft > 0
                ? `${spotsLeft} spot${spotsLeft === 1 ? "" : "s"} left.`
                : "Squad is full."
            }`
          : approved
            ? "This team is approved. Only an admin can change the roster."
            : `Invite verified players. They join the squad only after they accept. ${
                spotsLeft > 0
                  ? `${spotsLeft} spot${spotsLeft === 1 ? "" : "s"} left.`
                  : players.length === squadSize
                    ? "Squad is complete — waiting for admin approval."
                    : "All spots are held by accepted players or pending invites."
              }`}
      </p>

      {canChangeRoster && !isFull ? (
        <div className="mt-4">
          <PlayerSearchPicker
            selectedIds={blockedIds}
            onAdd={(p) => void invitePlayer(p)}
            disabled={busy}
            excludeTeamId={teamId}
            allowInvited={adminOverride}
          />
        </div>
      ) : null}

      {canChangeRoster && players.length === squadSize ? (
        <p className="mt-4 rounded-xl border border-[#2aa7ad]/25 bg-[#2aa7ad]/10 px-3 py-2 text-sm text-[#1a7f84]">
          Squad complete ({squadSize}/{squadSize} accepted).
          {!approved ? " An admin can now approve this team." : ""}
        </p>
      ) : null}

      {invites.length ? (
        <div className="mt-4">
          <p className="text-sm font-semibold text-[#3e2723]">
            Waiting for player to accept
          </p>
          <ul className="mt-2 space-y-2">
            {invites.map((invite) => (
              <li
                key={invite.id}
                className="flex items-center justify-between gap-2 rounded-xl border border-[#f5b830]/40 bg-[#fff6df] px-3 py-2"
              >
                <span className="text-sm font-semibold text-[#3e2723]">
                  {invite.player_code} — {invite.player_name}
                  <span className="mt-0.5 block text-xs font-normal text-[#8a6500]">
                    Invite sent — not in the squad yet
                  </span>
                </span>
                {canChangeRoster ? (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void withdrawInvite(invite.id)}
                    className="text-xs font-medium text-[#9f1239] disabled:opacity-50"
                  >
                    Withdraw
                  </button>
                ) : null}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <ul className="mt-4 space-y-2">
        {players.map((p) => (
          <li
            key={p.id}
            className="flex items-center justify-between gap-2 rounded-xl border border-[#3e2723]/8 bg-[#fdf6e8]/70 px-3 py-2"
          >
            <span className="text-sm font-semibold text-[#3e2723]">
              {formatPlayerLabel(p)}
            </span>
            {canChangeRoster ? (
              <button
                type="button"
                disabled={busy}
                onClick={() => void removePlayer(p.id)}
                className="text-xs font-medium text-[#9f1239] disabled:opacity-50"
              >
                Remove
              </button>
            ) : null}
          </li>
        ))}
        {players.length === 0 ? (
          <li className="text-sm text-[#3e2723]/50">
            No accepted players yet.
          </li>
        ) : null}
      </ul>

      {message ? (
        <p className="mt-3 text-sm text-[#1a7f84]" role="status">
          {message}
        </p>
      ) : null}
      {error ? (
        <pre className="mt-3 whitespace-pre-wrap font-sans text-sm text-[#9f1239]">
          {error}
        </pre>
      ) : null}
    </section>
  );
}
