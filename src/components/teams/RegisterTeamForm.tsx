"use client";

import { useState } from "react";
import { shortNameFromTeamName } from "@/lib/teams/labels";

function toTitleCase(value: string): string {
  return value.replace(
    /[^\s]+/g,
    (word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase(),
  );
}

export function RegisterTeamForm() {
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const preview = name.trim().length >= 2 ? shortNameFromTeamName(name) : "";

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (name.trim().length < 2) {
      setError("Team name must be at least 2 characters.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/teams", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ name: name.trim() }),
      });
      const data = (await res.json()) as {
        error?: string;
        request?: { id: string };
      };
      if (!res.ok) {
        setError(data.error ?? "Could not submit your request.");
        return;
      }
      if (data.request?.id) {
        window.location.assign("/teams?requested=1");
        return;
      }
      setError("Could not submit your request.");
    } catch {
      setError("Network error. Try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form
      onSubmit={(e) => void onSubmit(e)}
      className="mt-6 space-y-4 rounded-2xl border border-[#3e2723]/10 bg-white p-5 shadow-sm"
    >
      <label className="block">
        <span className="mb-1.5 block text-sm font-medium text-[#3e2723]">
          Team name <span className="text-[#d81b60]">*</span>
        </span>
        <input
          value={name}
          onChange={(e) => setName(toTitleCase(e.target.value))}
          placeholder="Radhe Krishna Club"
          maxLength={60}
          required
          className="w-full rounded-xl border border-[#3e2723]/15 bg-[#fdf6e8] px-3 py-3 text-base outline-none ring-[#2aa7ad] focus:ring-2"
        />
        {preview ? (
          <span className="mt-1.5 block text-xs text-[#3e2723]/50">
            Short name: {preview}
          </span>
        ) : (
          <span className="mt-1.5 block text-xs text-[#3e2723]/50">
            This name is sent to admin for approval. The team is created only
            after they approve.
          </span>
        )}
      </label>

      {error ? (
        <p
          role="alert"
          className="rounded-xl border border-[#d81b60]/25 bg-[#d81b60]/10 px-3 py-2 text-sm text-[#9f1239]"
        >
          {error}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={busy || name.trim().length < 2}
        className="touch-target flex w-full items-center justify-center rounded-full bg-[#2aa7ad] px-5 py-3 text-sm font-semibold text-white hover:bg-[#1a7f84] disabled:opacity-50"
      >
        {busy ? "Submitting…" : "Submit for approval"}
      </button>
    </form>
  );
}
