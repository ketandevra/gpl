"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { roleLabel } from "@/lib/auth/permissions";
import type { UserRole, VerificationStatus } from "@/lib/types/database";
import { verificationStatusLabel } from "@/lib/verification/helpers";

type AdminUser = {
  id: string;
  name: string;
  mobile_number: string;
  role: UserRole;
  is_active: boolean;
  created_at: string;
  last_login_at: string | null;
  locked_until: string | null;
  failed_login_attempts: number;
  verification_status: VerificationStatus;
};

export function AdminUsersClient({
  users: initialUsers,
  currentUserId,
}: {
  users: AdminUser[];
  currentUserId: string;
}) {
  const router = useRouter();
  const [users, setUsers] = useState(initialUsers);
  const [query, setQuery] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return users;
    return users.filter(
      (u) =>
        u.name.toLowerCase().includes(q) ||
        u.mobile_number.includes(q) ||
        u.role.includes(q),
    );
  }, [users, query]);

  async function patchUser(
    userId: string,
    updates: Partial<Pick<AdminUser, "role" | "is_active">>,
  ) {
    setBusyId(userId);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch("/api/admin/users", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: userId, ...updates }),
      });
      const data = (await res.json()) as {
        error?: string;
        user?: AdminUser;
      };
      if (!res.ok) {
        setError(data.error ?? "Update failed.");
        return;
      }
      if (data.user) {
        setUsers((prev) =>
          prev.map((u) => (u.id === userId ? { ...u, ...data.user } : u)),
        );
      }
      setMessage("User updated.");
      router.refresh();
    } catch {
      setError("Network error.");
    } finally {
      setBusyId(null);
    }
  }

  async function resetPin(userId: string, userName: string) {
    const newPin = window.prompt(
      `Enter a new 4-digit PIN for ${userName}`,
      "1234",
    );
    if (!newPin) return;
    if (!/^\d{4}$/.test(newPin)) {
      setError("PIN must be exactly 4 digits.");
      return;
    }

    setBusyId(userId);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "reset_pin",
          user_id: userId,
          new_pin: newPin,
        }),
      });
      const data = (await res.json()) as { error?: string; message?: string };
      if (!res.ok) {
        setError(data.error ?? "PIN reset failed.");
        return;
      }
      setMessage(data.message ?? "PIN reset.");
    } catch {
      setError("Network error.");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="px-4 py-8 lg:px-8">
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#2aa7ad]">
        Admin
      </p>
      <h1 className="mt-2 text-2xl font-bold text-[#3e2723]">Users</h1>
      <p className="mt-1 text-sm text-[#3e2723]/60">
        Manage roles, disable accounts, and reset PINs.
      </p>

      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search name, mobile, role"
        className="mt-5 w-full rounded-xl border border-[#3e2723]/15 bg-white px-3 py-3 text-sm outline-none ring-[#2aa7ad] focus:ring-2"
      />

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

      <ul className="mt-5 space-y-3">
        {filtered.map((user) => (
          <li
            key={user.id}
            className="rounded-2xl border border-[#3e2723]/10 bg-white p-4 shadow-sm"
          >
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <p className="font-semibold text-[#3e2723]">{user.name}</p>
                <p className="text-sm text-[#3e2723]/60">{user.mobile_number}</p>
                <p className="mt-1 text-xs font-medium text-[#3e2723]/55">
                  Verification: {verificationStatusLabel(user.verification_status)}
                </p>
              </div>
              <span
                className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${
                  user.is_active
                    ? "bg-[#2aa7ad]/15 text-[#1a7f84]"
                    : "bg-[#d81b60]/10 text-[#9f1239]"
                }`}
              >
                {user.is_active ? "Active" : "Disabled"}
              </span>
            </div>

            <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center">
              <Link
                href={`/admin/verifications?user_id=${encodeURIComponent(user.id)}`}
                className="rounded-full border border-[#2aa7ad]/40 px-3 py-1.5 text-center text-sm font-semibold text-[#1a7f84]"
              >
                Verification profile
              </Link>
              <label className="flex items-center gap-2 text-sm text-[#3e2723]">
                Role
                <select
                  value={user.role}
                  disabled={busyId === user.id}
                  onChange={(e) =>
                    patchUser(user.id, {
                      role: e.target.value as UserRole,
                    })
                  }
                  className="field-select field-inline"
                >
                  {(
                    [
                      "viewer",
                      "team_manager",
                      "scorer",
                      "admin",
                    ] as UserRole[]
                  ).map((role) => (
                    <option key={role} value={role}>
                      {roleLabel(role)}
                    </option>
                  ))}
                </select>
              </label>

              <button
                type="button"
                disabled={busyId === user.id || user.id === currentUserId}
                onClick={() =>
                  patchUser(user.id, { is_active: !user.is_active })
                }
                className="rounded-full border border-[#3e2723]/15 px-3 py-1.5 text-sm font-medium text-[#3e2723] disabled:opacity-50"
              >
                {user.is_active ? "Disable" : "Enable"}
              </button>

              <button
                type="button"
                disabled={busyId === user.id}
                onClick={() => resetPin(user.id, user.name)}
                className="rounded-full bg-[#f5b830] px-3 py-1.5 text-sm font-semibold text-[#3e2723] disabled:opacity-50"
              >
                Reset PIN
              </button>
            </div>
          </li>
        ))}
      </ul>

      {filtered.length === 0 ? (
        <p className="mt-6 text-sm text-[#3e2723]/60">No users found.</p>
      ) : null}
    </div>
  );
}
