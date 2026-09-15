"use client";

import Link from "next/link";
import { useState } from "react";

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

export function AuthForm({
  mode,
  nextPath = "/",
  registrationOpen = true,
}: AuthFormProps) {
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

      // Full navigation so the session cookie is definitely applied.
      const needsPlayerRegistration =
        data.user?.role !== "admin" &&
        data.user?.verification_status !== "verified";
      if (mode === "register" || needsPlayerRegistration) {
        window.location.assign("/verify");
        return;
      }

      // Verified users land on home unless a specific deep-link was requested
      // (e.g. /admin, /verify). Never send users to /profile after login.
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

  if (mode === "register" && !registrationOpen) {
    return (
      <div className="rounded-2xl border border-[#3e2723]/10 bg-white p-6 shadow-sm">
        <h1 className="text-2xl font-bold text-[#3e2723]">Registration closed</h1>
        <p className="mt-3 text-sm text-[#3e2723]/70">
          Public registration is not open right now. Ask a GPL admin to enable
          it, or sign in if you already have an account.
        </p>
        <Link
          href="/login"
          className="mt-6 inline-flex text-sm font-semibold text-[#1a7f84]"
        >
          Go to login →
        </Link>
      </div>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      noValidate
      className="rounded-2xl border border-[#3e2723]/10 bg-white p-6 shadow-sm"
    >
      <h1 className="text-2xl font-bold text-[#3e2723]">
        {mode === "login" ? "Login" : "Create account"}
      </h1>
      <p className="mt-2 text-sm text-[#3e2723]/65">
        {mode === "register"
          ? "Use your mobile number and 4-digit PIN. Next you’ll register as a player."
          : "Use your mobile number and 4-digit PIN."}
      </p>

      <div className="mt-6 space-y-4">
        {mode === "register" ? (
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-[#3e2723]">
              Full name
            </span>
            <input
              value={name}
              placeholder="Enter your full name as per Aadhaar"
              onChange={(e) => setName(toTitleCase(e.target.value))}
              className="w-full rounded-xl border border-[#3e2723]/15 bg-[#fdf6e8] px-3 py-3 text-base outline-none ring-[#2aa7ad] focus:ring-2"
              autoComplete="name"
            />
          </label>
        ) : null}

        <label className="block">
          <span className="mb-1.5 block text-sm font-medium text-[#3e2723]">
            Mobile number
          </span>
          <input
            inputMode="numeric"
            maxLength={10}
            value={mobile}
            onChange={(e) =>
              setMobile(e.target.value.replace(/\D/g, "").slice(0, 10))
            }
            placeholder="Enter your mobile number"
            className="w-full rounded-xl border border-[#3e2723]/15 bg-[#fdf6e8] px-3 py-3 text-base tracking-wide outline-none ring-[#2aa7ad] focus:ring-2"
            autoComplete="tel"
          />
        </label>

        <label className="block">
          <span className="mb-1.5 block text-sm font-medium text-[#3e2723]">
            4-digit PIN
          </span>
          <input
            inputMode="numeric"
            maxLength={4}
            type={pin ? "password" : "text"}
            value={pin}
            placeholder="Enter your 4-digit PIN"
            spellCheck={false}
            autoCorrect="off"
            onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 4))}
            className={`w-full rounded-xl border border-[#3e2723]/15 bg-[#fdf6e8] px-3 py-3 font-sans text-base outline-none ring-[#2aa7ad] placeholder:tracking-normal placeholder:font-sans focus:ring-2 ${
              pin ? "tracking-[0.4em]" : "tracking-normal"
            }`}
            autoComplete={mode === "login" ? "current-password" : "new-password"}
          />
        </label>

        {mode === "register" ? (
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-[#3e2723]">
              Confirm PIN
            </span>
            <input
              inputMode="numeric"
              maxLength={4}
              type={confirmPin ? "password" : "text"}
              value={confirmPin}
              placeholder="Confirm your 4-digit PIN"
              spellCheck={false}
              autoCorrect="off"
              onChange={(e) =>
                setConfirmPin(e.target.value.replace(/\D/g, "").slice(0, 4))
              }
              className={`w-full rounded-xl border border-[#3e2723]/15 bg-[#fdf6e8] px-3 py-3 font-sans text-base outline-none ring-[#2aa7ad] placeholder:tracking-normal placeholder:font-sans focus:ring-2 ${
                confirmPin ? "tracking-[0.4em]" : "tracking-normal"
              }`}
              autoComplete="new-password"
            />
          </label>
        ) : null}
      </div>

      {error ? (
        <p
          role="alert"
          className="mt-4 rounded-xl border border-[#d81b60]/25 bg-[#d81b60]/10 px-3 py-2 text-sm text-[#9f1239]"
        >
          {error}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={loading}
        className="touch-target mt-6 flex w-full items-center justify-center rounded-full bg-[#2aa7ad] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#1a7f84] disabled:opacity-60"
      >
        {loading
          ? mode === "login"
            ? "Signing in…"
            : "Creating account…"
          : mode === "login"
            ? "Sign in"
            : "Register"}
      </button>

      <p className="mt-4 text-center text-sm text-[#3e2723]/65">
        {mode === "login" ? (
          <>
            New here?{" "}
            <Link href="/register" className="font-semibold text-[#1a7f84]">
              Register
            </Link>
          </>
        ) : (
          <>
            Already registered?{" "}
            <Link href="/login" className="font-semibold text-[#1a7f84]">
              Login
            </Link>
          </>
        )}
      </p>
    </form>
  );
}
