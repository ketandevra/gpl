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

function isAndroid() {
  return /android/i.test(window.navigator.userAgent);
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
      }, 3000);
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
      <div className="gpl-splash-screen">
        <div className="gpl-splash-glow gpl-splash-glow-a" aria-hidden />
        <div className="gpl-splash-glow gpl-splash-glow-b" aria-hidden />
        <div className="gpl-splash-inner">
          <div>
            <div className="gpl-splash-kicker text-[11px] font-semibold uppercase tracking-[0.32em] text-[#f5b830]">
              Welcome to
            </div>
            <h1 className="gpl-splash-title mt-2 whitespace-nowrap text-[clamp(1.2rem,6.2vw,1.85rem)] font-bold leading-none text-[#fdf6e8]">
              Ghanchi Premier League
            </h1>
          </div>
          <div className="gpl-splash-logo mx-auto overflow-hidden rounded-2xl bg-[#fdf6e8]">
            <img
              src="/icons/icon-512.png"
              alt=""
              width={512}
              height={512}
              className="h-full w-full object-cover"
            />
          </div>
          <div>
            <p className="gpl-splash-brand text-3xl font-bold tracking-[0.32em] text-[#f5b830]">
              {APP_SHORT_NAME}
            </p>
            <p className="gpl-splash-line mt-3 text-base font-medium leading-snug text-[#fdf6e8]/85">
              Live scores. Rising stars. One trophy.
            </p>
            <p className="gpl-splash-sub mt-1 text-sm leading-snug text-[#fdf6e8]/55">
              The season is on.
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (isIos()) {
    return (
      <div className="fixed inset-0 z-[80] overflow-y-auto bg-[#3e2723] px-3 py-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-[max(1rem,env(safe-area-inset-top))]">
        <img
          src="/pwa/ios-install.png"
          alt="Install GPL on iPhone or iPad: open in Safari, tap Share, choose Add to Home Screen, then open GPL from the Home Screen."
          className="mx-auto w-full max-w-lg rounded-2xl bg-white shadow-2xl"
        />
      </div>
    );
  }

  if (isAndroid()) {
    return (
      <div className="fixed inset-0 z-[80] overflow-y-auto bg-[#3e2723] px-3 py-4 pb-[max(6rem,env(safe-area-inset-bottom))] pt-[max(1rem,env(safe-area-inset-top))]">
        <img
          src="/pwa/android-install.png"
          alt="Install GPL on Android: open in Chrome, tap Install app, confirm Install, then open GPL from the Home Screen."
          className="mx-auto w-full max-w-lg rounded-2xl bg-white shadow-2xl"
        />
        {installEvent ? (
          <div className="fixed inset-x-0 bottom-0 z-[81] bg-[#3e2723]/95 px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
            <button
              type="button"
              onClick={() => void install()}
              className="mx-auto block w-full max-w-lg rounded-full bg-[#f5b830] px-6 py-3 text-sm font-bold text-[#3e2723]"
            >
              Install app
            </button>
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[80] flex flex-col items-center justify-center bg-[#3e2723] px-6 text-center">
      <img
        src="/icons/icon-512.png"
        alt=""
        className="h-32 w-32 rounded-xl bg-[#fdf6e8] object-cover shadow-2xl"
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
      ) : (
        <p className="mt-8 max-w-sm text-sm text-[#fdf6e8]/80">
          Use your browser menu to install GPL, then open it from the home
          screen.
        </p>
      )}
    </div>
  );
}
