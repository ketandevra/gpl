"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState, useEffect, type ReactNode } from "react";
import { PlayerIdCard } from "@/components/auth/PlayerIdCard";
import { AvatarCropDialog } from "@/components/profile/AvatarCropDialog";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import {
  IconAdmin,
  IconBadge,
  IconBat,
  IconChevron,
  IconIdCard,
  IconInvite,
  IconLogout,
  IconPhone,
  IconScore,
  IconShield,
  IconShirt,
  IconTeam,
} from "@/components/ui/Icons";
import { UserAvatar } from "@/components/ui/UserAvatar";
import { VerifiedBadge } from "@/components/ui/VerifiedBadge";
import { roleLabel, type SessionUser } from "@/lib/auth/permissions";
import { compressImageFile } from "@/lib/images/compress-client";
import { playerRoleLabel } from "@/lib/teams/labels";
import type { TeamInviteView } from "@/lib/teams/types";
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

function Section({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="mt-4">
      <h2 className="px-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-[#3e2723]/45">
        {title}
      </h2>
      <div className="mt-1.5 divide-y divide-[#3e2723]/6 overflow-hidden rounded-[1.25rem] border border-[#3e2723]/8 bg-white shadow-[0_8px_22px_rgba(62,39,35,0.05)]">
        {children}
      </div>
    </section>
  );
}

function InfoRow({
  icon,
  label,
  value,
}: {
  icon: ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center gap-3 px-4 py-2.5">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#2aa7ad]/10 text-[#1a7f84]">
        {icon}
      </span>
      <div className="min-w-0">
        <p className="text-[11px] font-medium text-[#3e2723]/50">{label}</p>
        <p className="truncate text-sm font-semibold text-[#3e2723]">{value}</p>
      </div>
    </div>
  );
}

function ActionRow({
  href,
  icon,
  label,
  tone = "default",
  onClick,
}: {
  href?: string;
  icon: ReactNode;
  label: string;
  tone?: "default" | "gold" | "danger" | "admin";
  onClick?: () => void;
}) {
  const tones = {
    default: "text-[#3e2723]",
    gold: "text-[#8a6500]",
    danger: "text-[#9f1239]",
    admin: "text-[#1a7f84]",
  };
  const className = `flex w-full items-center gap-3 px-4 py-3 text-left ${tones[tone]}`;
  const inner = (
    <>
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#3e2723]/6">
        {icon}
      </span>
      <span className="min-w-0 flex-1 text-sm font-semibold">{label}</span>
      <IconChevron className="h-4 w-4 opacity-40" />
    </>
  );

  if (href) {
    return (
      <Link href={href} className={className}>
        {inner}
      </Link>
    );
  }

  return (
    <button type="button" onClick={onClick} className={className}>
      {inner}
    </button>
  );
}

export function ProfileClient({
  user,
  playerId = null,
  playingRole = null,
  tshirtSize = null,
  captainTeams = [],
  invites = [],
}: {
  user: SessionUser;
  playerId?: string | null;
  playingRole?: PlayerRole | null;
  tshirtSize?: TshirtSize | null;
  captainTeams?: CaptainTeam[];
  invites?: TeamInviteView[];
}) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [avatarUrl, setAvatarUrl] = useState(user.avatar_url);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [cropFile, setCropFile] = useState<File | null>(null);
  const [showIdCard, setShowIdCard] = useState(false);
  const [confirmLogout, setConfirmLogout] = useState(false);
  const [pendingInvites, setPendingInvites] = useState(invites);
  const [inviteBusy, setInviteBusy] = useState<string | null>(null);

  useEffect(() => {
    setPendingInvites(invites);
  }, [invites]);
  const verified = user.verification_status === "verified";
  const canShowIdCard = verified && Boolean(playerId);

  const playingRoleLabelText =
    REGISTRATION_PLAYER_ROLES.find((r) => r.value === playingRole)?.label ??
    (playingRole ? playerRoleLabel(playingRole) : null);

  async function respondToInvite(
    inviteId: string,
    decision: "accept" | "decline",
  ) {
    setInviteBusy(inviteId);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch("/api/invites", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ invite_id: inviteId, decision }),
      });
      const data = (await res.json()) as {
        error?: string;
        invites?: TeamInviteView[];
      };
      if (!res.ok) {
        setError(data.error ?? "Could not update invite.");
        return;
      }
      setPendingInvites(data.invites ?? []);
      setMessage(
        decision === "accept"
          ? "You joined the squad."
          : "Invite declined. You were not added to the team.",
      );
      router.refresh();
    } catch {
      setError("Network error.");
    } finally {
      setInviteBusy(null);
    }
  }

  async function logout() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/logout", { method: "POST" });
      if (!res.ok) {
        setError("Could not log out. Try again.");
        setConfirmLogout(false);
        return;
      }
      router.replace("/login");
      router.refresh();
    } catch {
      setError("Network error.");
      setConfirmLogout(false);
    } finally {
      setLoading(false);
    }
  }

  function onPickPhoto(file: File | undefined) {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setError("Only image uploads are allowed.");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setError("Image must be 5 MB or smaller.");
      return;
    }
    setError(null);
    setMessage(null);
    setCropFile(file);
    if (fileRef.current) fileRef.current.value = "";
  }

  async function uploadCroppedPhoto(cropped: File) {
    setCropFile(null);
    setUploading(true);
    setError(null);
    setMessage(null);
    try {
      const compressed = await compressImageFile(cropped, "avatar");
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
    }
  }

  return (
    <div className="page max-w-lg">
      <div className="relative overflow-hidden rounded-[1.75rem] border border-[#3e2723]/8 bg-gradient-to-b from-[#fff8ea] via-white to-white px-5 pb-6 pt-8 text-center shadow-[0_14px_36px_rgba(62,39,35,0.1)]">
        <div
          className="pointer-events-none absolute -right-12 -top-10 h-40 w-40 rounded-full bg-[#f5b830]/30 blur-3xl"
          aria-hidden
        />
        <div
          className="pointer-events-none absolute -left-14 top-24 h-36 w-36 rounded-full bg-[#2aa7ad]/22 blur-3xl"
          aria-hidden
        />

        <div className="relative mx-auto w-fit">
          <div className="rounded-full bg-gradient-to-br from-[#f5b830] via-[#2aa7ad] to-[#1a7f84] p-[3px] shadow-[0_12px_30px_rgba(42,167,173,0.28)]">
            <span className="block rounded-full bg-white p-1">
              <UserAvatar
                name={user.name}
                src={avatarUrl}
                size="xl"
                shape="circle"
                fit="cover"
              />
            </span>
          </div>
          <label
            className={`absolute bottom-1 right-1 inline-flex h-10 w-10 cursor-pointer items-center justify-center rounded-full bg-[#2aa7ad] text-white shadow-md ring-4 ring-white ${
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

        <h1 className="relative mt-5 text-[1.45rem] font-bold leading-tight tracking-tight text-[#3e2723] sm:text-3xl">
          {user.name}
        </h1>
        {playingRoleLabelText ? (
          <p className="relative mt-1 text-sm font-medium text-[#3e2723]/60">
            {playingRoleLabelText}
          </p>
        ) : null}
        <div className="relative mt-3 flex flex-wrap items-center justify-center gap-2">
          {playerId ? (
            <p className="inline-flex items-center rounded-full bg-[#2aa7ad]/12 px-3 py-1 text-sm font-semibold tracking-wide text-[#1a7f84]">
              {playerId}
            </p>
          ) : null}
          {verified ? <VerifiedBadge /> : null}
        </div>
      </div>

      {pendingInvites.length > 0 ? (
        <section className="mt-4">
          <h2 className="px-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-[#3e2723]/45">
            Team invites
          </h2>
          <div className="mt-1.5 rounded-2xl border border-[#f5b830]/45 bg-[#fff6df] p-4 shadow-sm">
          <p className="flex items-center gap-2 text-sm font-semibold text-[#3e2723]">
            <IconInvite className="h-4 w-4 text-[#8a6500]" />
            Pending invites
          </p>
          <p className="mt-1 text-xs text-[#3e2723]/60">
            Accept to join the squad. If you decline, you will not be added.
          </p>
          <ul className="mt-3 space-y-3">
            {pendingInvites.map((invite) => (
              <li
                key={invite.id}
                className="rounded-xl border border-[#3e2723]/10 bg-white px-3 py-3"
              >
                <p className="font-semibold text-[#3e2723]">
                  {invite.team_name}{" "}
                  <span className="font-medium text-[#3e2723]/55">
                    ({invite.team_short_name})
                  </span>
                </p>
                <p className="mt-0.5 text-xs text-[#3e2723]/55">
                  {invite.invited_by_name
                    ? `${invite.invited_by_name} invited you to join this team.`
                    : "You were invited to join this team."}
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    type="button"
                    disabled={inviteBusy !== null}
                    onClick={() => void respondToInvite(invite.id, "accept")}
                    className="rounded-full bg-[#2aa7ad] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
                  >
                    {inviteBusy === invite.id ? "Saving…" : "Accept"}
                  </button>
                  <button
                    type="button"
                    disabled={inviteBusy !== null}
                    onClick={() => void respondToInvite(invite.id, "decline")}
                    className="rounded-full border border-[#3e2723]/20 px-4 py-2 text-sm font-semibold text-[#3e2723] disabled:opacity-50"
                  >
                    Decline
                  </button>
                </div>
              </li>
            ))}
          </ul>
          </div>
        </section>
      ) : null}

      <Section title="Personal details">
        <InfoRow
          icon={<IconPhone />}
          label="Mobile"
          value={user.mobile_number}
        />
        {playingRoleLabelText ? (
          <InfoRow
            icon={<IconBat />}
            label="Playing role"
            value={playingRoleLabelText}
          />
        ) : null}
        {tshirtSize ? (
          <InfoRow icon={<IconShirt />} label="T-shirt" value={tshirtSize} />
        ) : null}
      </Section>

      <Section title="Account">
        <InfoRow
          icon={<IconShield />}
          label="Role"
          value={roleLabel(user.role)}
        />
        {!verified ? (
          <InfoRow
            icon={<IconBadge />}
            label="Verification"
            value={verificationStatusLabel(user.verification_status)}
          />
        ) : null}
      </Section>

      {captainTeams.length > 0 ? (
        <Section title="Teams">
          {captainTeams.map((team) => (
            <Link
              key={team.id}
              href={`/teams/${team.id}`}
              className="flex items-center gap-3 px-4 py-3"
            >
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#2aa7ad]/10 text-[#1a7f84]">
                <IconTeam />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-semibold text-[#3e2723]">
                  {team.name}
                </span>
                <span className="block text-[11px] font-medium text-[#3e2723]/50">
                  {team.short_name} · Captain
                </span>
              </span>
              <IconChevron className="h-4 w-4 text-[#1a7f84]/50" />
            </Link>
          ))}
        </Section>
      ) : null}

      <Section title="Player">
        {canShowIdCard ? (
          <ActionRow
            icon={<IconIdCard />}
            label="ID card"
            tone="gold"
            onClick={() => setShowIdCard(true)}
          />
        ) : null}
        <ActionRow
          href="/verify"
          icon={<IconBadge />}
          label={
            !verified
              ? user.verification_status === "pending"
                ? "View registration"
                : "Register as player"
              : "Player registration"
          }
          tone={!verified ? "admin" : "default"}
        />
      </Section>

      {user.role === "admin" || user.role === "scorer" ? (
        <Section title="Tools">
          {user.role === "admin" ? (
            <ActionRow
              href="/admin"
              icon={<IconAdmin />}
              label="Admin dashboard"
              tone="admin"
            />
          ) : null}
          <ActionRow
            href="/scoring"
            icon={<IconScore />}
            label="Scoring desk"
          />
        </Section>
      ) : null}

      <Section title="Session">
        <ActionRow
          icon={<IconLogout />}
          label="Log out"
          tone="danger"
          onClick={() => setConfirmLogout(true)}
        />
      </Section>

      {message ? (
        <p className="mt-3 text-sm text-[#1a7f84]" role="status">
          {message}
        </p>
      ) : null}
      {error ? (
        <p className="mt-3 text-sm text-[#9f1239]" role="alert">
          {error}
        </p>
      ) : null}

      {cropFile ? (
        <AvatarCropDialog
          file={cropFile}
          onCancel={() => setCropFile(null)}
          onConfirm={(cropped) => void uploadCroppedPhoto(cropped)}
        />
      ) : null}

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

      {confirmLogout ? (
        <ConfirmDialog
          title="Log out?"
          body="You’ll need your mobile number and PIN to sign back in."
          confirmLabel="Log out"
          danger
          busy={loading}
          onCancel={() => setConfirmLogout(false)}
          onConfirm={() => void logout()}
        />
      ) : null}
    </div>
  );
}
