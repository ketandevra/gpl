"use client";

import Link from "next/link";
import { useEffect, useState, type FocusEvent } from "react";
import { BrandLogo } from "@/components/brand/BrandLogo";
import { APP_NAME, APP_SHORT_NAME } from "@/lib/constants";

function toTitleCase(value: string): string {
  return value.replace(
    /[^\s]+/g,
    (word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase(),
  );
}

type AuthFormProps = {
  mode: "login" | "register";
  nextPath?: string;
  registrationOpen?: boolean;
};

function useKeyboardInset() {
  const [inset, setInset] = useState(0);

  useEffect(() => {
    const viewport = window.visualViewport;
    if (!viewport) return;

    function update() {
      const height = viewport!.height;
      const offsetTop = viewport!.offsetTop;
      const next = Math.max(0, window.innerHeight - height - offsetTop);
      setInset(next > 40 ? next : 0);
    }

    update();
    viewport.addEventListener("resize", update);
    viewport.addEventListener("scroll", update);
    return () => {
      viewport.removeEventListener("resize", update);
      viewport.removeEventListener("scroll", update);
    };
  }, []);

  return inset;
}

function scrollFieldIntoView(event: FocusEvent<HTMLInputElement>) {
  const target = event.currentTarget;
  window.setTimeout(() => {
    target.scrollIntoView({ block: "center", behavior: "smooth" });
  }, 280);
}

function PinBoxes({
  value,
  onChange,
  label,
  autoComplete,
}: {
  value: string;
  onChange: (next: string) => void;
  label: string;
  autoComplete?: string;
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-[13px] font-semibold text-[#3e2723]/70">
        {label}
      </span>
      <div className="relative">
        <input
          inputMode="numeric"
          maxLength={4}
          value={value}
          autoComplete={autoComplete}
          spellCheck={false}
          autoCorrect="off"
          onChange={(event) =>
            onChange(event.target.value.replace(/\D/g, "").slice(0, 4))
          }
          onFocus={scrollFieldIntoView}
          className="absolute inset-0 z-10 cursor-text opacity-0"
          aria-label={label}
        />
        <div className="grid grid-cols-4 gap-2.5">
          {[0, 1, 2, 3].map((index) => {
            const filled = Boolean(value[index]);
            const active = value.length === index || (value.length === 4 && index === 3);
            return (
              <div
                key={index}
                className={`flex h-14 items-center justify-center rounded-2xl bg-white text-2xl font-bold text-[#3e2723] shadow-[0_1px_0_rgba(62,39,35,0.04)] ${
                  active
                    ? "ring-2 ring-[#2aa7ad]"
                    : "ring-1 ring-[#3e2723]/10"
                }`}
              >
                {filled ? "•" : ""}
              </div>
            );
          })}
        </div>
      </div>
    </label>
  );
}

export function AuthForm({
  mode,
  nextPath = "/",
  registrationOpen = true,
}: AuthFormProps) {
  const keyboardInset = useKeyboardInset();
  const [name, setName] = useState("");
  const [mobile, setMobile] = useState("");
  const [pin, setPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  function validate(): string | null {
    if (!/^[6-9]\d{9}$/.test(mobile)) {
      return "Enter a valid 10-digit Indian mobile number.";
    }
    if (!/^\d{4}$/.test(pin)) {
      return "PIN must be exactly 4 digits.";
    }
    if (mode === "register") {
      if (name.trim().length < 2) {
        return "Enter your full name.";
      }
      if (pin !== confirmPin) {
        return "PINs do not match.";
      }
    }
    return null;
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    const validationError = validate();
    if (validationError) {
      setError(validationError);
      return;
    }

    setLoading(true);

    try {
      const endpoint =
        mode === "login" ? "/api/auth/login" : "/api/auth/register";
      const body =
        mode === "login"
          ? { mobile_number: mobile, pin }
          : {
              name: name.trim(),
              mobile_number: mobile,
              pin,
              confirm_pin: confirmPin,
            };

      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify(body),
      });

      let data: {
        error?: string;
        user?: { role: string; verification_status?: string };
      } = {};
      try {
        data = (await res.json()) as typeof data;
      } catch {
        setError("Unexpected server response. Please try again.");
        return;
      }

      if (!res.ok) {
        setError(data.error ?? "Something went wrong.");
        return;
      }

      const needsPlayerRegistration =
        data.user?.role !== "admin" &&
        data.user?.verification_status !== "verified";
      if (mode === "register" || needsPlayerRegistration) {
        window.location.assign("/verify");
        return;
      }

      const requested =
        nextPath && nextPath.startsWith("/") ? nextPath : "/";
      const destination =
        !requested ||
        requested === "/" ||
        requested === "/profile" ||
        requested === "/login" ||
        requested === "/register"
          ? "/"
          : requested;

      window.location.assign(destination);
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  const shellStyle = {
    minHeight:
      keyboardInset > 0
        ? `calc(100% - ${keyboardInset}px)`
        : "100%",
    paddingBottom: keyboardInset > 0 ? 12 : undefined,
  } as const;

  if (mode === "register" && !registrationOpen) {
    return (
      <div
        className="mx-auto flex w-full max-w-md flex-col px-5 py-6"
        style={shellStyle}
      >
        <div className="flex items-center gap-2.5">
          <BrandLogo variant="mark" href="/" />
          <div className="min-w-0 leading-tight">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#2aa7ad]">
              {APP_SHORT_NAME}
            </p>
            <p className="text-[15px] font-bold text-[#3e2723]">{APP_NAME}</p>
          </div>
        </div>
        <h1 className="mt-10 text-[1.7rem] font-bold leading-tight tracking-tight text-[#3e2723]">
          Registration closed
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-[#3e2723]/60">
          Public registration is not open right now. Ask a GPL admin to enable
          it, or sign in if you already have an account.
        </p>
        <Link
          href="/login"
          className="mt-8 inline-flex h-12 items-center justify-center rounded-full bg-[#f5b830] text-sm font-bold text-[#3e2723]"
        >
          Go to login
        </Link>
      </div>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      noValidate
      className="mx-auto flex w-full max-w-md flex-col overflow-y-auto px-5 pb-7 pt-3"
      style={shellStyle}
    >
      <div className="flex items-center gap-2.5">
        <BrandLogo variant="mark" href="/" priority />
        <div className="min-w-0 leading-tight">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#2aa7ad]">
            {APP_SHORT_NAME}
          </p>
          <p className="text-[15px] font-bold text-[#3e2723]">{APP_NAME}</p>
        </div>
      </div>

      <h1 className="mt-8 text-[1.75rem] font-bold leading-[1.15] tracking-tight text-[#3e2723]">
        {mode === "login" ? "Welcome back" : "Join the league"}
      </h1>
      <p className="mt-2 text-sm leading-relaxed text-[#3e2723]/58">
        {mode === "register"
          ? "Create your account with mobile and a 4-digit PIN. Next you’ll register as a player."
          : "Sign in with your mobile number and 4-digit PIN."}
      </p>

      <div className="mt-8 space-y-5">
        {mode === "register" ? (
          <label className="block">
            <span className="mb-2 block text-[13px] font-semibold text-[#3e2723]/70">
              Full name
            </span>
            <input
              value={name}
              placeholder="Name as per Aadhaar"
              onChange={(event) => setName(toTitleCase(event.target.value))}
              onFocus={scrollFieldIntoView}
              className="h-14 w-full rounded-2xl bg-white px-4 text-base text-[#3e2723] outline-none ring-1 ring-[#3e2723]/10 placeholder:text-[#3e2723]/35 focus:ring-2 focus:ring-[#2aa7ad]"
              autoComplete="name"
            />
          </label>
        ) : null}

        <label className="block">
          <span className="mb-2 block text-[13px] font-semibold text-[#3e2723]/70">
            Mobile number
          </span>
          <div className="flex h-14 items-center gap-3 rounded-2xl bg-white px-3 ring-1 ring-[#3e2723]/10 focus-within:ring-2 focus-within:ring-[#2aa7ad]">
            <span className="inline-flex shrink-0 items-center rounded-full bg-[#2aa7ad]/12 px-2.5 py-1 text-sm font-bold text-[#1a7f84]">
              +91
            </span>
            <input
              inputMode="numeric"
              maxLength={10}
              value={mobile}
              onChange={(event) =>
                setMobile(event.target.value.replace(/\D/g, "").slice(0, 10))
              }
              onFocus={scrollFieldIntoView}
              placeholder="10-digit number"
              className="h-full min-w-0 flex-1 bg-transparent text-base tracking-[0.14em] text-[#3e2723] outline-none placeholder:tracking-normal placeholder:text-[#3e2723]/35"
              autoComplete="tel"
            />
          </div>
        </label>

        <PinBoxes
          value={pin}
          onChange={setPin}
          label="4-digit PIN"
          autoComplete={mode === "login" ? "current-password" : "new-password"}
        />

        {mode === "register" ? (
          <PinBoxes
            value={confirmPin}
            onChange={setConfirmPin}
            label="Confirm PIN"
            autoComplete="new-password"
          />
        ) : null}
      </div>

      {error ? (
        <p
          role="alert"
          className="mt-5 rounded-2xl bg-[#d81b60]/10 px-3.5 py-2.5 text-sm font-medium text-[#9f1239]"
        >
          {error}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={loading}
        className="touch-target mt-8 flex h-14 w-full items-center justify-center rounded-full bg-[#f5b830] px-5 text-[15px] font-bold text-[#3e2723] shadow-[0_10px_24px_rgba(245,184,48,0.28)] transition hover:bg-[#ffcf5c] disabled:opacity-60"
      >
        {loading
          ? mode === "login"
            ? "Signing in…"
            : "Creating account…"
          : mode === "login"
            ? "Sign in"
            : "Create account"}
      </button>

      <p className="mt-5 pb-2 text-center text-sm text-[#3e2723]/60">
        {mode === "login" ? (
          <>
            New to GPL?{" "}
            <Link href="/register" className="font-bold text-[#1a7f84]">
              Create account
            </Link>
          </>
        ) : (
          <>
            Already have an account?{" "}
            <Link href="/login" className="font-bold text-[#1a7f84]">
              Sign in
            </Link>
          </>
        )}
      </p>
    </form>
  );
}
