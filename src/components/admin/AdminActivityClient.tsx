"use client";

import { useMemo, useState } from "react";
import { UserAvatar } from "@/components/ui/UserAvatar";
import type { ActivityEvent } from "@/lib/admin/activity-types";

const IST = { timeZone: "Asia/Kolkata" } as const;

function dateKey(iso: string) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleDateString("en-CA", IST);
}

function formatDateHeading(key: string) {
  const today = new Date().toLocaleDateString("en-CA", IST);
  const yesterday = new Date(Date.now() - 86_400_000).toLocaleDateString(
    "en-CA",
    IST,
  );
  if (key === today) return "Today";
  if (key === yesterday) return "Yesterday";
  const date = new Date(`${key}T12:00:00+05:30`);
  if (Number.isNaN(date.getTime())) return key;
  return date.toLocaleDateString("en-IN", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
    ...IST,
  });
}

function formatDateTime(iso: string) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    ...IST,
  });
}

function playerLine(event: ActivityEvent) {
  const name = event.user?.name ?? "Deleted user";
  const playerId = event.user?.public_code ?? "—";
  return `${playerId} - ${name}`;
}

function actionLabel(action: ActivityEvent["action"]) {
  return action === "auth.login" ? "Logged in" : "Logged out";
}

export function AdminActivityClient({ events: initial }: { events: ActivityEvent[] }) {
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  const groups = useMemo(() => {
    const byDate = new Map<string, ActivityEvent[]>();
    for (const event of initial) {
      const key = dateKey(event.created_at);
      const list = byDate.get(key) ?? [];
      list.push(event);
      byDate.set(key, list);
    }
    return [...byDate.entries()];
  }, [initial]);

  const dates = useMemo(() => groups.map(([key]) => key), [groups]);
  const activeDate =
    selectedDate && dates.includes(selectedDate) ? selectedDate : (dates[0] ?? null);
  const activeIndex = activeDate ? dates.indexOf(activeDate) : -1;
  const activeEvents =
    activeDate != null
      ? (groups.find(([key]) => key === activeDate)?.[1] ?? [])
      : [];
  const canOlder = activeIndex >= 0 && activeIndex < dates.length - 1;
  const canNewer = activeIndex > 0;

  return (
    <div className="px-3 py-5 sm:px-4 sm:py-8 lg:px-8">
      {initial.length === 0 ? (
        <p className="rounded-xl border border-dashed border-[#3e2723]/15 px-4 py-6 text-sm text-[#3e2723]/55">
          No login or logout events yet.
        </p>
      ) : (
        <section>
          <div className="flex items-center gap-2 rounded-2xl border border-[#3e2723]/10 bg-white px-2 py-2 shadow-sm">
            <button
              type="button"
              aria-label="Older date"
              disabled={!canOlder}
              onClick={() => setSelectedDate(dates[activeIndex + 1] ?? null)}
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-2xl leading-none text-[#3e2723] disabled:opacity-25"
            >
              ‹
            </button>
            <div className="min-w-0 flex-1 text-center">
              <p className="text-sm font-bold text-[#3e2723]">
                {activeDate ? formatDateHeading(activeDate) : "—"}
              </p>
              <p className="text-xs text-[#3e2723]/50">
                {activeEvents.length}{" "}
                {activeEvents.length === 1 ? "event" : "events"}
                {dates.length > 1
                  ? ` · ${activeIndex + 1} of ${dates.length} days`
                  : ""}
              </p>
            </div>
            <button
              type="button"
              aria-label="Newer date"
              disabled={!canNewer}
              onClick={() => setSelectedDate(dates[activeIndex - 1] ?? null)}
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-2xl leading-none text-[#3e2723] disabled:opacity-25"
            >
              ›
            </button>
          </div>

          <ul className="mt-3 space-y-2">
            {activeEvents.map((event) => (
              <li
                key={event.id}
                className="overflow-hidden rounded-2xl border border-[#3e2723]/10 bg-white shadow-sm"
              >
                <div className="flex items-stretch">
                  <div className="relative w-[4.75rem] shrink-0 self-stretch bg-[#fdf6e8] sm:w-24">
                    <UserAvatar
                      name={event.user?.name ?? "User"}
                      src={event.user?.avatar_url}
                      size="fill"
                      shape="rounded"
                      className="!rounded-none text-lg"
                    />
                  </div>
                  <div className="flex min-w-0 flex-1 items-start justify-between gap-2 px-3 py-3">
                    <div className="min-w-0">
                      <p className="font-semibold text-[#3e2723]">
                        {playerLine(event)}
                      </p>
                      <p className="mt-0.5 text-sm text-[#3e2723]/70">
                        {event.user?.mobile_number ?? "—"}
                      </p>
                      <p className="mt-0.5 text-xs text-[#3e2723]/50">
                        {formatDateTime(event.created_at)}
                      </p>
                    </div>
                    <span
                      className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                        event.action === "auth.login"
                          ? "bg-[#2aa7ad]/15 text-[#1a7f84]"
                          : "bg-[#efe4cf] text-[#3e2723]"
                      }`}
                    >
                      {actionLabel(event.action)}
                    </span>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
