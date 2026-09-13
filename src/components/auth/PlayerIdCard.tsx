"use client";

import { useEffect, useRef, useState } from "react";
import { toPng } from "html-to-image";
import { QRCodeSVG } from "qrcode.react";
import { UserAvatar } from "@/components/ui/UserAvatar";
import { APP_SHORT_NAME, LOGO_PATH } from "@/lib/constants";

type PlayerIdCardProps = {
  open: boolean;
  onClose: () => void;
  name: string;
  playerId: string;
  playingRole: string | null;
  avatarUrl: string | null;
};

function waitForImages(root: HTMLElement) {
  const images = Array.from(root.querySelectorAll("img"));
  return Promise.all(
    images.map((img) =>
      img.complete
        ? Promise.resolve()
        : new Promise<void>((resolve) => {
            img.addEventListener("load", () => resolve(), { once: true });
            img.addEventListener("error", () => resolve(), { once: true });
          }),
    ),
  );
}

/** Portrait credit-card size (~54×86mm feel on screen). */
export function PlayerIdCard({
  open,
  onClose,
  name,
  playerId,
  playingRole,
  avatarUrl,
}: PlayerIdCardProps) {
  const cardRef = useRef<HTMLDivElement>(null);
  const [downloading, setDownloading] = useState(false);
  const [downloadError, setDownloadError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  useEffect(() => {
    if (!open) {
      setDownloading(false);
      setDownloadError(null);
    }
  }, [open]);

  async function downloadCard() {
    const node = cardRef.current;
    if (!node || downloading) return;
    setDownloading(true);
    setDownloadError(null);
    try {
      await waitForImages(node);
      const dataUrl = await toPng(node, {
        cacheBust: true,
        pixelRatio: 3,
      });
      const safeId = playerId.replace(/[^a-zA-Z0-9_-]/g, "") || "card";
      const link = document.createElement("a");
      link.download = `gpl-id-${safeId}.png`;
      link.href = dataUrl;
      link.click();
    } catch {
      setDownloadError("Could not save the ID card. Try again.");
    } finally {
      setDownloading(false);
    }
  }

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-[#3e2723]/60 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label="Player ID card"
      onClick={onClose}
    >
      <div className="relative" onClick={(e) => e.stopPropagation()}>
        <button
          type="button"
          onClick={onClose}
          className="absolute -right-2.5 -top-2.5 z-10 flex h-8 w-8 items-center justify-center rounded-full bg-white text-base font-bold leading-none text-[#3e2723] shadow-lg ring-1 ring-[#3e2723]/10"
          aria-label="Close ID card"
        >
          ×
        </button>

        <div
          ref={cardRef}
          className="relative w-[340px] overflow-hidden rounded-2xl shadow-[0_20px_50px_-12px_rgba(62,39,35,0.55)] ring-1 ring-white/30"
          style={{ aspectRatio: "54 / 86" }}
        >
          <div className="absolute inset-0 bg-gradient-to-b from-[#1a7f84] via-[#2aa7ad] to-[#145e62]" />
          <div
            className="pointer-events-none absolute -right-8 -top-6 h-28 w-28 rounded-full bg-[#f5b830]/25 blur-2xl"
            aria-hidden
          />
          <div
            className="pointer-events-none absolute -bottom-10 -left-8 h-32 w-32 rounded-full bg-white/10 blur-2xl"
            aria-hidden
          />

          <div className="relative flex h-full flex-col px-4 py-3">
            <header className="flex items-center justify-center gap-2.5 border-b border-[#f5b830]/45 pb-2.5">
              {/* Plain img so the downloaded PNG includes the mark reliably. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={LOGO_PATH}
                alt=""
                width={40}
                height={40}
                className="h-10 w-10 shrink-0 rounded-full object-cover object-[center_35%] shadow-sm ring-2 ring-[#f5b830]"
              />
              <p className="whitespace-nowrap text-[18px] font-extrabold leading-none tracking-tight text-[#f5b830]">
                Ghanchi Premier League
              </p>
            </header>

            <div className="flex flex-1 flex-col items-center justify-center gap-3">
              <div className="flex h-[102px] w-[102px] items-center justify-center overflow-hidden rounded-full bg-[#145e62] p-[3px] shadow-md ring-2 ring-[#f5b830]">
                <UserAvatar
                  name={name}
                  src={avatarUrl}
                  size="sm"
                  fit="cover"
                  backgroundColor={avatarUrl ? "#145e62" : "#fdf6e8"}
                  crossOrigin="anonymous"
                  className="!h-full !w-full text-lg"
                />
              </div>

              <div className="flex flex-col items-center gap-1.5 text-center">
                <p className="line-clamp-2 max-w-full px-0.5 text-[22px] font-extrabold leading-snug text-white">
                  {name}
                </p>
                <p className="font-mono text-[16px] font-bold tracking-wider text-[#f5b830]">
                  {playerId}
                </p>
                {playingRole ? (
                  <p className="rounded-full bg-white/15 px-3 py-1 text-[13px] font-semibold uppercase tracking-wide text-white">
                    {playingRole}
                  </p>
                ) : null}
              </div>
            </div>

            <div className="flex flex-col items-center">
              <div className="rounded-xl bg-white p-1.5 shadow-md">
                <QRCodeSVG
                  value={playerId}
                  size={80}
                  level="M"
                  bgColor="#ffffff"
                  fgColor="#3e2723"
                  marginSize={0}
                  title={`Player ID ${playerId}`}
                />
              </div>
            </div>

            <footer className="mt-2 border-t border-white/15 pt-1.5 text-center">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/80">
                {APP_SHORT_NAME} · Official
              </p>
            </footer>
          </div>
        </div>

        <button
          type="button"
          onClick={() => void downloadCard()}
          disabled={downloading}
          className="mt-3 flex w-full items-center justify-center gap-2 rounded-full bg-[#f5b830] px-4 py-2.5 text-sm font-semibold text-[#3e2723] shadow-md transition hover:bg-[#ffcf5c] disabled:opacity-60"
        >
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
            <path d="M12 3v12" />
            <path d="m7 11 5 5 5-5" />
            <path d="M5 21h14" />
          </svg>
          {downloading ? "Saving…" : "Download image"}
        </button>
        {downloadError ? (
          <p className="mt-2 text-center text-xs text-[#ffcf5c]" role="alert">
            {downloadError}
          </p>
        ) : null}
      </div>
    </div>
  );
}
