"use client";

import { useEffect, useState } from "react";
import { APP_NAME, APP_SHORT_NAME } from "@/lib/constants";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

function isStandalone() {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    window.matchMedia("(display-mode: fullscreen)").matches ||
    Boolean(
      (window.navigator as Navigator & { standalone?: boolean }).standalone,
    )
  );
}

function isLocalDevHost() {
  if (typeof window === "undefined") return false;
  const host = window.location.hostname;
  if (host === "localhost" || host === "127.0.0.1") return true;
  if (/^192\.168\.\d+\.\d+$/.test(host)) return true;
  if (/^10\.\d+\.\d+\.\d+$/.test(host)) return true;
  return false;
}

function isIos() {
  return /iphone|ipad|ipod/i.test(window.navigator.userAgent);
}

export function PwaProvider() {
  const [mode, setMode] = useState<"splash" | "gate" | "ready">("splash");
  const [installEvent, setInstallEvent] =
    useState<BeforeInstallPromptEvent | null>(null);

  useEffect(() => {
    function syncAppHeight() {
      const height = window.innerHeight;
      if (height > 0) {
        document.documentElement.style.setProperty("--app-height", `${height}px`);
      }
    }
    syncAppHeight();
    window.addEventListener("resize", syncAppHeight);
    window.addEventListener("orientationchange", syncAppHeight);
    return () => {
      window.removeEventListener("resize", syncAppHeight);
      window.removeEventListener("orientationchange", syncAppHeight);
    };
  }, []);

  useEffect(() => {
    if ("serviceWorker" in navigator) {
      void navigator.serviceWorker.register("/sw.js", { scope: "/" });
    }

    function onPrompt(event: Event) {
      event.preventDefault();
      setInstallEvent(event as BeforeInstallPromptEvent);
    }
    window.addEventListener("beforeinstallprompt", onPrompt);

    const standalone = isStandalone();
    const local = isLocalDevHost();

    if (!standalone && !local) {
      setMode("gate");
      return () => window.removeEventListener("beforeinstallprompt", onPrompt);
    }

    const alreadyShown = sessionStorage.getItem("gpl-splash-shown") === "1";
    if (alreadyShown) {
      setMode("ready");
    } else {
      setMode("splash");
      const timer = window.setTimeout(() => {
        sessionStorage.setItem("gpl-splash-shown", "1");
        setMode("ready");
      }, 400);
      return () => {
        window.clearTimeout(timer);
        window.removeEventListener("beforeinstallprompt", onPrompt);
      };
    }

    return () => window.removeEventListener("beforeinstallprompt", onPrompt);
  }, []);

  async function install() {
    if (!installEvent) return;
    await installEvent.prompt();
  }

  if (mode === "ready") return null;

  if (mode === "splash") {
    return (
      <div className="fixed inset-0 z-[80] flex flex-col items-center justify-center bg-[#3e2723] px-8">
        <img
          src="/icons/icon-512.png"
          alt={APP_NAME}
          className="h-36 w-36 rounded-[2rem] bg-[#fdf6e8] object-contain shadow-2xl"
        />
        <p className="mt-6 text-2xl font-bold tracking-[0.28em] text-[#f5b830]">
          {APP_SHORT_NAME}
        </p>
        <p className="mt-2 text-center text-sm font-medium text-[#fdf6e8]/80">
          {APP_NAME}
        </p>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[80] flex flex-col items-center justify-center bg-[#3e2723] px-6 text-center">
      <img
        src="/icons/icon-512.png"
        alt=""
        className="h-32 w-32 rounded-[1.75rem] bg-[#fdf6e8] object-contain shadow-2xl"
      />
      <p className="mt-6 text-2xl font-bold tracking-[0.28em] text-[#f5b830]">
        {APP_SHORT_NAME}
      </p>
      <h1 className="mt-3 max-w-xs text-xl font-bold text-[#fdf6e8]">
        {APP_NAME}
      </h1>
      <p className="mt-3 max-w-sm text-sm leading-relaxed text-[#fdf6e8]/75">
        Open GPL from your home screen. The website is not available in the
        browser.
      </p>

      {installEvent ? (
        <button
          type="button"
          onClick={() => void install()}
          className="mt-8 rounded-full bg-[#f5b830] px-6 py-3 text-sm font-bold text-[#3e2723]"
        >
          Install app
        </button>
      ) : isIos() ? (
        <ol className="mt-8 max-w-sm space-y-2 text-left text-sm text-[#fdf6e8]/90">
          <li>1. Tap the Share button in Safari</li>
          <li>2. Choose Add to Home Screen</li>
          <li>3. Open the GPL icon to continue</li>
        </ol>
      ) : (
        <p className="mt-8 max-w-sm text-sm text-[#fdf6e8]/80">
          Use your browser menu to install GPL, then open it from the home
          screen.
        </p>
      )}
    </div>
  );
}
