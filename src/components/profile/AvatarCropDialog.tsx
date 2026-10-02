"use client";

import { useCallback, useEffect, useRef, useState } from "react";

const VIEW = 280;
const OUTPUT = 512;
const MIN_ZOOM = 1;
const MAX_ZOOM = 4;

type AvatarCropDialogProps = {
  file: File;
  onCancel: () => void;
  onConfirm: (file: File) => void;
};

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

async function loadOrientedBitmap(file: File): Promise<ImageBitmap> {
  try {
    return await createImageBitmap(file, {
      imageOrientation: "from-image",
    } as ImageBitmapOptions);
  } catch {
    return createImageBitmap(file);
  }
}

export function AvatarCropDialog({
  file,
  onCancel,
  onConfirm,
}: AvatarCropDialogProps) {
  const bitmapRef = useRef<ImageBitmap | null>(null);
  const dragRef = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    panX: number;
    panY: number;
  } | null>(null);
  const pinchRef = useRef<{ distance: number; zoom: number } | null>(null);

  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [natW, setNatW] = useState(1);
  const [natH, setNatH] = useState(1);
  const [zoom, setZoom] = useState(1);
  const [panX, setPanX] = useState(0);
  const [panY, setPanY] = useState(0);
  const [loadError, setLoadError] = useState<string | null>(null);

  const coverW = natW / natH >= 1 ? VIEW * (natW / natH) : VIEW;
  const coverH = natW / natH >= 1 ? VIEW : VIEW * (natH / natW);
  const displayW = coverW * zoom;
  const displayH = coverH * zoom;
  const maxPanX = Math.max(0, (displayW - VIEW) / 2);
  const maxPanY = Math.max(0, (displayH - VIEW) / 2);

  const applyZoom = useCallback((next: number) => {
    setZoom(clamp(next, MIN_ZOOM, MAX_ZOOM));
  }, []);

  useEffect(() => {
    let revoked: string | null = null;
    let cancelled = false;
    void (async () => {
      try {
        const bitmap = await loadOrientedBitmap(file);
        if (cancelled) {
          bitmap.close();
          return;
        }
        bitmapRef.current = bitmap;
        setNatW(bitmap.width);
        setNatH(bitmap.height);
        const maxEdge = 1600;
        const scale = Math.min(
          1,
          maxEdge / Math.max(bitmap.width, bitmap.height),
        );
        const canvas = document.createElement("canvas");
        canvas.width = Math.max(1, Math.round(bitmap.width * scale));
        canvas.height = Math.max(1, Math.round(bitmap.height * scale));
        const ctx = canvas.getContext("2d");
        if (!ctx) throw new Error("Could not read this image.");
        ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
        const blob = await new Promise<Blob | null>((resolve) =>
          canvas.toBlob(resolve, "image/jpeg", 0.92),
        );
        if (!blob) throw new Error("Could not read this image.");
        const url = URL.createObjectURL(blob);
        revoked = url;
        setPreviewUrl(url);
        setZoom(1);
        setPanX(0);
        setPanY(0);
      } catch {
        if (!cancelled) setLoadError("Could not open this image. Try another.");
      }
    })();
    return () => {
      cancelled = true;
      if (revoked) URL.revokeObjectURL(revoked);
      bitmapRef.current?.close();
      bitmapRef.current = null;
    };
  }, [file]);

  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, []);

  useEffect(() => {
    setPanX((x) => clamp(x, -maxPanX, maxPanX));
    setPanY((y) => clamp(y, -maxPanY, maxPanY));
  }, [maxPanX, maxPanY]);

  function onPointerDown(event: React.PointerEvent<HTMLDivElement>) {
    if (pinchRef.current) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      panX,
      panY,
    };
  }

  function onPointerMove(event: React.PointerEvent<HTMLDivElement>) {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId || pinchRef.current) return;
    const nextX = drag.panX + (event.clientX - drag.startX);
    const nextY = drag.panY + (event.clientY - drag.startY);
    setPanX(clamp(nextX, -maxPanX, maxPanX));
    setPanY(clamp(nextY, -maxPanY, maxPanY));
  }

  function onPointerUp(event: React.PointerEvent<HTMLDivElement>) {
    if (dragRef.current?.pointerId === event.pointerId) dragRef.current = null;
  }

  function onTouchStart(event: React.TouchEvent<HTMLDivElement>) {
    if (event.touches.length === 2) {
      dragRef.current = null;
      pinchRef.current = {
        distance: Math.hypot(
          event.touches[0]!.clientX - event.touches[1]!.clientX,
          event.touches[0]!.clientY - event.touches[1]!.clientY,
        ),
        zoom,
      };
    }
  }

  function onTouchMove(event: React.TouchEvent<HTMLDivElement>) {
    const pinch = pinchRef.current;
    if (!pinch || event.touches.length !== 2) return;
    event.preventDefault();
    const distance = Math.hypot(
      event.touches[0]!.clientX - event.touches[1]!.clientX,
      event.touches[0]!.clientY - event.touches[1]!.clientY,
    );
    if (pinch.distance < 8) return;
    applyZoom(pinch.zoom * (distance / pinch.distance));
  }

  function onTouchEnd(event: React.TouchEvent<HTMLDivElement>) {
    if (event.touches.length < 2) pinchRef.current = null;
  }

  function onWheel(event: React.WheelEvent<HTMLDivElement>) {
    event.preventDefault();
    applyZoom(zoom * (event.deltaY > 0 ? 0.92 : 1.08));
  }

  async function confirm() {
    const bitmap = bitmapRef.current;
    if (!bitmap) return;
    const left = (VIEW - displayW) / 2 + panX;
    const top = (VIEW - displayH) / 2 + panY;
    const sx = (-left / displayW) * bitmap.width;
    const sy = (-top / displayH) * bitmap.height;
    const sw = (VIEW / displayW) * bitmap.width;
    const sh = (VIEW / displayH) * bitmap.height;
    const canvas = document.createElement("canvas");
    canvas.width = OUTPUT;
    canvas.height = OUTPUT;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.fillStyle = "#fdf6e8";
    ctx.fillRect(0, 0, OUTPUT, OUTPUT);
    ctx.drawImage(bitmap, sx, sy, sw, sh, 0, 0, OUTPUT, OUTPUT);
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", 0.9),
    );
    if (!blob) return;
    onConfirm(
      new File([blob], "avatar.jpg", {
        type: "image/jpeg",
        lastModified: Date.now(),
      }),
    );
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-[#3e2723]/55 p-0 sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="avatar-crop-title"
    >
      <div className="w-full max-w-md rounded-t-3xl bg-[#fdf6e8] p-5 shadow-xl sm:rounded-3xl">
        <h2
          id="avatar-crop-title"
          className="text-lg font-bold text-[#3e2723]"
        >
          Adjust photo
        </h2>
        <p className="mt-1 text-sm text-[#3e2723]/65">
          Drag to move. Zoom until your face fills the circle.
        </p>

        {loadError ? (
          <p className="mt-4 rounded-xl border border-[#d81b60]/25 bg-[#d81b60]/10 px-3 py-2 text-sm text-[#9f1239]">
            {loadError}
          </p>
        ) : (
          <>
            <div
              className="relative mx-auto mt-4 touch-none overflow-hidden rounded-full bg-[#3e2723] ring-2 ring-[#f5b830]"
              style={{ width: VIEW, height: VIEW }}
              onPointerDown={onPointerDown}
              onPointerMove={onPointerMove}
              onPointerUp={onPointerUp}
              onPointerCancel={onPointerUp}
              onTouchStart={onTouchStart}
              onTouchMove={onTouchMove}
              onTouchEnd={onTouchEnd}
              onWheel={onWheel}
            >
              {previewUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={previewUrl}
                  alt=""
                  draggable={false}
                  className="absolute max-h-none max-w-none select-none"
                  style={{
                    width: displayW,
                    height: displayH,
                    left: (VIEW - displayW) / 2 + panX,
                    top: (VIEW - displayH) / 2 + panY,
                  }}
                />
              ) : (
                <div className="flex h-full items-center justify-center text-sm text-white/70">
                  Loading…
                </div>
              )}
            </div>

            <div className="mt-4 flex items-center gap-3">
              <button
                type="button"
                onClick={() => applyZoom(zoom - 0.15)}
                className="touch-target flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-[#3e2723]/15 bg-white text-lg font-semibold text-[#3e2723]"
                aria-label="Zoom out"
              >
                −
              </button>
              <input
                type="range"
                min={MIN_ZOOM}
                max={MAX_ZOOM}
                step={0.01}
                value={zoom}
                onChange={(e) => applyZoom(Number(e.target.value))}
                className="h-2 w-full accent-[#2aa7ad]"
                aria-label="Zoom"
              />
              <button
                type="button"
                onClick={() => applyZoom(zoom + 0.15)}
                className="touch-target flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-[#3e2723]/15 bg-white text-lg font-semibold text-[#3e2723]"
                aria-label="Zoom in"
              >
                +
              </button>
            </div>
          </>
        )}

        <div className="mt-5 flex gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 rounded-full border border-[#3e2723]/15 bg-white py-3 text-sm font-semibold text-[#3e2723]"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={!previewUrl || Boolean(loadError)}
            onClick={() => void confirm()}
            className="flex-1 rounded-full bg-[#2aa7ad] py-3 text-sm font-semibold text-white disabled:opacity-50"
          >
            Save photo
          </button>
        </div>
      </div>
    </div>
  );
}
