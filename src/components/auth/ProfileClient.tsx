"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { PlayerIdCard } from "@/components/auth/PlayerIdCard";
import { UserAvatar } from "@/components/ui/UserAvatar";
import { roleLabel, type SessionUser } from "@/lib/auth/permissions";
import { compressImageFile } from "@/lib/images/compress-client";
import { playerRoleLabel } from "@/lib/teams/labels";
import { verificationStatusLabel } from "@/lib/verification/helpers";
import {
  REGISTRATION_PLAYER_ROLES,
  type TshirtSize,
} from "@/lib/verification/registration";
import type { PlayerRole } from "@/lib/types/database";

type CaptainTeam = {
  id: string;
  name: string;
  short_name: string;
  registration_status: string;
};

export function ProfileClient({
  user,
  playerId = null,
  playingRole = null,
  tshirtSize = null,
  captainTeams = [],
}: {
  user: SessionUser;
  playerId?: string | null;
  playingRole?: PlayerRole | null;
  tshirtSize?: TshirtSize | null;
  captainTeams?: CaptainTeam[];
}) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [avatarUrl, setAvatarUrl] = useState(user.avatar_url);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [showIdCard, setShowIdCard] = useState(false);
  const canShowIdCard =
    user.verification_status === "verified" && Boolean(playerId);

  const playingRoleLabelText =
    REGISTRATION_PLAYER_ROLES.find((r) => r.value === playingRole)?.label ??
    (playingRole ? playerRoleLabel(playingRole) : null);

  async function logout() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/logout", { method: "POST" });
      if (!res.ok) {
        setError("Could not log out. Try again.");
        return;
      }
      router.replace("/login");
      router.refresh();
    } catch {
      setError("Network error.");
    } finally {
      setLoading(false);
    }
  }

  async function onPickPhoto(file: File | undefined) {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setError("Only image uploads are allowed.");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setError("Image must be 5 MB or smaller.");
      return;
    }
    setUploading(true);
    setError(null);
    setMessage(null);
    try {
      const compressed = await compressImageFile(file, "avatar");
      const form = new FormData();
      form.set("file", compressed);
      const res = await fetch("/api/profile/avatar", {
        method: "POST",
        body: form,
        credentials: "same-origin",
      });
      const data = (await res.json()) as {
        error?: string;
        avatar_url?: string;
      };
      if (!res.ok) {
        setError(data.error ?? "Upload failed.");
        return;
      }
      setAvatarUrl(data.avatar_url ?? null);
      setMessage("Profile photo updated.");
      router.refresh();
    } catch {
      setError("Network error during upload.");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  return (
    <div className="mx-auto max-w-lg px-4 py-8 sm:py-10">
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#2aa7ad]">
        Profile
      </p>

      <div className="mt-6 flex flex-col items-center gap-3 rounded-2xl border border-[#3e2723]/10 bg-white p-5 shadow-sm">
        <div className="relative">
          <UserAvatar
            name={user.name}
            src={avatarUrl}
            size="lg"
            shape="rounded"
            fit="contain"
            className="border-2 border-[#2aa7ad]/30 shadow-sm"
          />
          <label
            className={`absolute bottom-1 right-1 inline-flex h-9 w-9 cursor-pointer items-center justify-center rounded-full bg-[#2aa7ad] text-white shadow-md ring-2 ring-white transition hover:bg-[#1a7f84] ${
              uploading ? "pointer-events-none opacity-60" : ""
            }`}
            aria-label={uploading ? "Uploading photo" : "Edit profile photo"}
          >
            {uploading ? (
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
            ) : (
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="h-4 w-4"
                aria-hidden
              >
                <path d="M12 20h9" />
                <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
              </svg>
            )}
            <input
              ref={fileRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp"
              className="sr-only"
              disabled={uploading}
              onChange={(e) => void onPickPhoto(e.target.files?.[0])}
            />
          </label>
        </div>
        <h1 className="text-center text-2xl font-bold text-[#3e2723]">
          {user.name}
        </h1>
        {playerId ? (
          <p className="text-sm font-semibold tracking-wide text-[#1a7f84]">
            Player ID: {playerId}
          </p>
        ) : null}
      </div>

      <dl className="mt-4 space-y-3 rounded-2xl border border-[#3e2723]/10 bg-white p-5 shadow-sm">
        <div>
          <dt className="text-xs uppercase tracking-wide text-[#3e2723]/50">
            Mobile
          </dt>
          <dd className="mt-1 font-medium text-[#3e2723]">
            {user.mobile_number}
          </dd>
        </div>
        {playingRoleLabelText ? (
          <div>
            <dt className="text-xs uppercase tracking-wide text-[#3e2723]/50">
              Playing role
            </dt>
            <dd className="mt-1 font-medium text-[#3e2723]">
              {playingRoleLabelText}
            </dd>
          </div>
        ) : null}
        {tshirtSize ? (
          <div>
            <dt className="text-xs uppercase tracking-wide text-[#3e2723]/50">
              T-shirt size
            </dt>
            <dd className="mt-1 font-medium text-[#3e2723]">{tshirtSize}</dd>
          </div>
        ) : null}
        <div>
          <dt className="text-xs uppercase tracking-wide text-[#3e2723]/50">
            Account role
          </dt>
          <dd className="mt-1 font-medium text-[#3e2723]">
            {roleLabel(user.role)}
          </dd>
        </div>
        <div>
          <dt className="text-xs uppercase tracking-wide text-[#3e2723]/50">
            Verification
          </dt>
          <dd className="mt-1 font-medium text-[#3e2723]">
            {verificationStatusLabel(user.verification_status)}
          </dd>
        </div>
      </dl>

      {captainTeams.length > 0 ? (
        <div className="mt-4 rounded-2xl border border-[#2aa7ad]/25 bg-[#2aa7ad]/8 p-4">
          <p className="text-sm font-semibold text-[#1a7f84]">Your team (captain)</p>
          <ul className="mt-2 space-y-2">
            {captainTeams.map((t) => (
              <li key={t.id}>
                <Link
                  href={`/teams/${t.id}`}
                  className="font-semibold text-[#3e2723] hover:text-[#1a7f84]"
                >
                  {t.name} ({t.short_name}) — manage squad →
                </Link>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {canShowIdCard ? (
        <button
          type="button"
          onClick={() => setShowIdCard(true)}
          className="touch-target mt-4 flex w-full items-center justify-center rounded-full bg-[#f5b830] px-5 py-3 text-sm font-semibold text-[#3e2723] transition hover:bg-[#ffcf5c]"
        >
          ID Card
        </button>
      ) : null}

      {user.verification_status !== "verified" ? (
        <Link
          href="/verify"
          className="mt-4 flex touch-target w-full items-center justify-center rounded-full bg-[#2aa7ad] px-5 py-3 text-sm font-semibold text-white"
        >
          {user.verification_status === "pending"
            ? "View registration status"
            : "Register as player"}
        </Link>
      ) : (
        <Link
          href="/verify"
          className="mt-4 inline-flex text-sm font-semibold text-[#1a7f84]"
        >
          View player registration →
        </Link>
      )}

      {user.role === "admin" ? (
        <Link
          href="/admin"
          className="mt-4 inline-flex touch-target items-center justify-center rounded-full bg-[#2aa7ad] px-5 py-3 text-sm font-semibold text-white"
        >
          Open admin dashboard
        </Link>
      ) : null}

      {user.role === "admin" || user.role === "scorer" ? (
        <Link
          href="/scoring"
          className="mt-3 inline-flex touch-target items-center justify-center rounded-full border border-[#d81b60]/40 bg-[#fff5f8] px-5 py-3 text-sm font-semibold text-[#d81b60]"
        >
          Scoring desk
        </Link>
      ) : null}

      {message ? (
        <p className="mt-4 text-sm text-[#1a7f84]" role="status">
          {message}
        </p>
      ) : null}
      {error ? (
        <p className="mt-4 text-sm text-[#9f1239]" role="alert">
          {error}
        </p>
      ) : null}

      <button
        type="button"
        onClick={logout}
        disabled={loading}
        className="touch-target mt-6 flex w-full items-center justify-center rounded-full border border-[#3e2723]/20 bg-white px-5 py-3 text-sm font-semibold text-[#3e2723] disabled:opacity-60"
      >
        {loading ? "Signing out…" : "Log out"}
      </button>

      {canShowIdCard && playerId ? (
        <PlayerIdCard
          open={showIdCard}
          onClose={() => setShowIdCard(false)}
          name={user.name}
          playerId={playerId}
          playingRole={playingRoleLabelText}
          avatarUrl={avatarUrl}
        />
      ) : null}
    </div>
  );
}
