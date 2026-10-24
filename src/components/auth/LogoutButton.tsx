"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";

export function LogoutButton({ className = "" }: { className?: string }) {
  const router = useRouter();
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function logout() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/logout", { method: "POST" });
      if (!res.ok) {
        setError("Could not log out. Try again.");
        setConfirm(false);
        return;
      }
      router.replace("/login");
      router.refresh();
    } catch {
      setError("Network error.");
      setConfirm(false);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={className}>
      <button
        type="button"
        onClick={() => setConfirm(true)}
        className="rounded-full border border-[#3e2723]/15 bg-white px-4 py-2 text-sm font-semibold text-[#3e2723]"
      >
        Log out
      </button>
      {error ? (
        <p className="mt-2 text-xs text-[#9f1239]" role="alert">
          {error}
        </p>
      ) : null}
      {confirm ? (
        <ConfirmDialog
          title="Log out?"
          body="You’ll need your mobile number and PIN to sign back in."
          confirmLabel="Log out"
          danger
          busy={busy}
          onCancel={() => setConfirm(false)}
          onConfirm={() => void logout()}
        />
      ) : null}
    </div>
  );
}