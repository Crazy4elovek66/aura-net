"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

interface AdminSnapshot {
  generatedAt: string;
  numbers: {
    totalProfiles: number;
    newProfiles24h: number;
    votes24h: number;
    rewards24h: number;
    pendingNotifications: number;
    failedNotifications24h: number;
    limitedProfiles: number;
    hiddenFromDiscover: number;
    hiddenFromLeaderboards: number;
    specialCards: number;
    activeBoosts: number;
    criticalEvents24h: number;
  };
  recentProfiles: Array<{
    id: string;
    username: string;
    displayName: string;
    auraPoints: number;
    createdAt: string;
    activeBoostUntil: string | null;
    moderation: {
      is_limited: boolean;
      hide_from_discover: boolean;
      hide_from_leaderboards: boolean;
      reason: string | null;
    } | null;
  }>;
  suspiciousProfiles: Array<{
    id: string;
    username: string;
    displayName: string;
    auraPoints: number;
    reason: string;
    score: number;
    details: string;
    moderation: {
      is_limited: boolean;
      hide_from_discover: boolean;
      hide_from_leaderboards: boolean;
      reason: string | null;
    } | null;
  }>;
  moderatedProfiles: Array<{
    id: string;
    username: string;
    displayName: string;
    auraPoints: number;
    isLimited: boolean;
    hideFromDiscover: boolean;
    hideFromLeaderboards: boolean;
    reason: string | null;
    note: string | null;
    updatedAt: string;
    activeBoostUntil: string | null;
  }>;
  specialCardProfiles: Array<{
    id: string;
    username: string;
    displayName: string;
    auraPoints: number;
    specialCard: string;
    activeBoostUntil: string | null;
    moderation: {
      is_limited: boolean;
      hide_from_discover: boolean;
      hide_from_leaderboards: boolean;
      reason: string | null;
    } | null;
  }>;
  failedNotifications: Array<{
    id: string;
    profileId: string;
    username: string;
    displayName: string;
    eventType: string;
    errorMessage: string | null;
    createdAt: string;
  }>;
  recentEvents: Array<{
    id: string;
    level: "info" | "warn" | "error" | "critical";
    scope: string;
    eventType: string;
    requestPath: string | null;
    message: string | null;
    createdAt: string;
    profile: {
      id: string;
      username: string;
      displayName: string;
    } | null;
  }>;
}

function formatTime(value: string | null | undefined) {
  if (!value) return "—";
  return new Date(value).toLocaleString("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function levelTone(level: AdminSnapshot["recentEvents"][number]["level"]) {
  switch (level) {
    case "critical":
      return "border-red-400/40 bg-red-500/10 text-red-100";
    case "error":
      return "border-orange-400/40 bg-orange-500/10 text-orange-100";
    case "warn":
      return "border-yellow-400/40 bg-yellow-500/10 text-yellow-100";
    default:
      return "border-white/10 bg-white/[0.04] text-white/80";
  }
}

async function postAdminAction(payload: Record<string, unknown>) {
  const response = await fetch("/api/admin/moderation", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  const result = (await response.json().catch(() => ({}))) as { error?: string };
  if (!response.ok) {
    throw new Error(result.error || "Admin action failed");
  }
}

function ActionButtons({
  profileId,
  reason,
  isLimited,
  hideFromDiscover,
  hideFromLeaderboards,
}: {
  profileId: string;
  reason?: string | null;
  isLimited: boolean;
  hideFromDiscover: boolean;
  hideFromLeaderboards: boolean;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [localError, setLocalError] = useState<string | null>(null);

  const run = (payload: Record<string, unknown>) => {
    startTransition(async () => {
      try {
        setLocalError(null);
        await postAdminAction({
          profileId,
          reason: reason || "manual_admin_action",
          ...payload,
        });
        router.refresh();
      } catch (error) {
        setLocalError(error instanceof Error ? error.message : "Admin action failed");
      }
    });
  };

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={isPending}
          onClick={() => run({ action: isLimited ? "restore" : "limit" })}
          className="rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-[10px] font-black uppercase tracking-[0.16em] text-white/80 transition hover:bg-white/10 disabled:opacity-50"
        >
          {isLimited ? "Restore" : "Limit"}
        </button>
        <button
          type="button"
          disabled={isPending}
          onClick={() => run({ action: hideFromDiscover ? "show_discover" : "hide_discover" })}
          className="rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-[10px] font-black uppercase tracking-[0.16em] text-white/80 transition hover:bg-white/10 disabled:opacity-50"
        >
          {hideFromDiscover ? "Show Discover" : "Hide Discover"}
        </button>
        <button
          type="button"
          disabled={isPending}
          onClick={() => run({ action: hideFromLeaderboards ? "show_leaderboards" : "hide_leaderboards" })}
          className="rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-[10px] font-black uppercase tracking-[0.16em] text-white/80 transition hover:bg-white/10 disabled:opacity-50"
        >
          {hideFromLeaderboards ? "Show LB" : "Hide LB"}
        </button>
      </div>
      {localError ? <p className="text-[11px] text-red-300">{localError}</p> : null}
    </div>
  );
}

export default function AdminOpsDashboard({ snapshot }: { snapshot: AdminSnapshot }) {
  const topNumbers = useMemo(
    () => [
      { label: "Profiles", value: snapshot.numbers.totalProfiles },
      { label: "New 24h", value: snapshot.numbers.newProfiles24h },
      { label: "Votes 24h", value: snapshot.numbers.votes24h },
      { label: "Rewards 24h", value: snapshot.numbers.rewards24h },
      { label: "Pending notifications", value: snapshot.numbers.pendingNotifications },
      { label: "Failed notifications 24h", value: snapshot.numbers.failedNotifications24h },
      { label: "Limited profiles", value: snapshot.numbers.limitedProfiles },
      { label: "Critical events 24h", value: snapshot.numbers.criticalEvents24h },
    ],
    [snapshot],
  );

  return (
    <div className="min-h-screen bg-background text-white font-unbounded">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-8 md:px-6">
        <header className="rounded-[2rem] border border-white/10 bg-black/35 p-6 backdrop-blur-xl">
          <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="text-[11px] font-black uppercase tracking-[0.28em] text-white/45">Aura Ops</p>
              <h1 className="mt-2 text-3xl font-black uppercase tracking-tight">Admin / Ops Readiness</h1>
              <p className="mt-3 max-w-3xl text-sm text-white/60">
                Минимальный operational слой поверх текущего стека: live numbers, suspicious activity, moderation actions,
                failed delivery queue и последние системные события.
              </p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-[11px] text-white/60">
              Snapshot: {formatTime(snapshot.generatedAt)}
            </div>
          </div>
        </header>

        <section className="grid gap-3 md:grid-cols-4">
          {topNumbers.map((item) => (
            <div key={item.label} className="rounded-[1.6rem] border border-white/10 bg-black/25 p-4 backdrop-blur-xl">
              <p className="text-[10px] font-black uppercase tracking-[0.22em] text-white/45">{item.label}</p>
              <p className="mt-3 text-3xl font-black tracking-tight">{item.value.toLocaleString("ru-RU")}</p>
            </div>
          ))}
        </section>

        <section className="grid gap-6 xl:grid-cols-[1.25fr_1fr]">
          <div className="rounded-[2rem] border border-white/10 bg-black/25 p-5 backdrop-blur-xl">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-black uppercase tracking-tight">Suspicious Activity</h2>
                <p className="text-[11px] text-white/50">Простые эвристики для поиска abuse перед публичным запуском.</p>
              </div>
            </div>
            <div className="space-y-3">
              {snapshot.suspiciousProfiles.length ? (
                snapshot.suspiciousProfiles.map((profile) => (
                  <div key={`${profile.id}-${profile.reason}`} className="rounded-[1.4rem] border border-white/10 bg-white/[0.03] p-4">
                    <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                      <div className="space-y-1">
                        <p className="text-sm font-black text-white">{profile.displayName}</p>
                        <p className="text-[11px] uppercase tracking-[0.18em] text-white/45">@{profile.username}</p>
                        <p className="text-sm text-white/75">{profile.reason}</p>
                        <p className="text-[12px] text-white/55">{profile.details}</p>
                      </div>
                      <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-right">
                        <p className="text-[10px] font-black uppercase tracking-[0.18em] text-white/45">Score</p>
                        <p className="mt-2 text-2xl font-black">{profile.score}</p>
                        <p className="mt-2 text-[11px] text-white/45">{profile.auraPoints} aura</p>
                      </div>
                    </div>
                    <div className="mt-4">
                      <ActionButtons
                        profileId={profile.id}
                        reason={profile.moderation?.reason || profile.reason}
                        isLimited={Boolean(profile.moderation?.is_limited)}
                        hideFromDiscover={Boolean(profile.moderation?.hide_from_discover)}
                        hideFromLeaderboards={Boolean(profile.moderation?.hide_from_leaderboards)}
                      />
                    </div>
                  </div>
                ))
              ) : (
                <div className="rounded-[1.4rem] border border-dashed border-white/10 p-4 text-sm text-white/55">
                  Явных подозрительных паттернов по текущим эвристикам не найдено.
                </div>
              )}
            </div>
          </div>

          <div className="rounded-[2rem] border border-white/10 bg-black/25 p-5 backdrop-blur-xl">
            <h2 className="text-lg font-black uppercase tracking-tight">System Events</h2>
            <p className="mt-1 text-[11px] text-white/50">Последние ops events из runtime и admin actions.</p>
            <div className="mt-4 space-y-3">
              {snapshot.recentEvents.length ? (
                snapshot.recentEvents.map((event) => (
                  <div key={event.id} className={`rounded-[1.35rem] border p-3 ${levelTone(event.level)}`}>
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-[10px] font-black uppercase tracking-[0.18em]">
                        {event.level} / {event.scope}
                      </p>
                      <p className="text-[11px] opacity-70">{formatTime(event.createdAt)}</p>
                    </div>
                    <p className="mt-2 text-sm font-semibold">{event.eventType}</p>
                    {event.message ? <p className="mt-1 text-[12px] opacity-80">{event.message}</p> : null}
                    {event.requestPath ? <p className="mt-1 text-[11px] opacity-70">{event.requestPath}</p> : null}
                    {event.profile ? (
                      <p className="mt-1 text-[11px] opacity-70">
                        {event.profile.displayName} @{event.profile.username}
                      </p>
                    ) : null}
                  </div>
                ))
              ) : (
                <div className="rounded-[1.4rem] border border-dashed border-white/10 p-4 text-sm text-white/55">
                  Ops events пока не записаны.
                </div>
              )}
            </div>
          </div>
        </section>

        <section className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
          <div className="rounded-[2rem] border border-white/10 bg-black/25 p-5 backdrop-blur-xl">
            <h2 className="text-lg font-black uppercase tracking-tight">Moderation State</h2>
            <p className="mt-1 text-[11px] text-white/50">Кого уже ограничили или скрыли из публичных поверхностей.</p>
            <div className="mt-4 space-y-3">
              {snapshot.moderatedProfiles.length ? (
                snapshot.moderatedProfiles.map((profile) => (
                  <div key={profile.id} className="rounded-[1.4rem] border border-white/10 bg-white/[0.03] p-4">
                    <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                      <div>
                        <p className="text-sm font-black">{profile.displayName}</p>
                        <p className="text-[11px] uppercase tracking-[0.18em] text-white/45">@{profile.username}</p>
                        <p className="mt-2 text-[12px] text-white/70">
                          {[
                            profile.isLimited ? "limited" : null,
                            profile.hideFromDiscover ? "hidden from discover" : null,
                            profile.hideFromLeaderboards ? "hidden from leaderboards" : null,
                          ]
                            .filter(Boolean)
                            .join(" • ") || "active"}
                        </p>
                        {profile.reason ? <p className="mt-2 text-[12px] text-white/55">{profile.reason}</p> : null}
                        {profile.note ? <p className="mt-1 text-[12px] text-white/45">{profile.note}</p> : null}
                        {profile.activeBoostUntil ? (
                          <p className="mt-1 text-[11px] text-white/45">Boost active until {formatTime(profile.activeBoostUntil)}</p>
                        ) : null}
                      </div>
                      <div className="text-right text-[11px] text-white/45">Updated {formatTime(profile.updatedAt)}</div>
                    </div>
                    <div className="mt-4">
                      <ActionButtons
                        profileId={profile.id}
                        reason={profile.reason}
                        isLimited={profile.isLimited}
                        hideFromDiscover={profile.hideFromDiscover}
                        hideFromLeaderboards={profile.hideFromLeaderboards}
                      />
                    </div>
                  </div>
                ))
              ) : (
                <div className="rounded-[1.4rem] border border-dashed border-white/10 p-4 text-sm text-white/55">
                  Активных moderation flags нет.
                </div>
              )}
            </div>
          </div>

          <div className="rounded-[2rem] border border-white/10 bg-black/25 p-5 backdrop-blur-xl">
            <h2 className="text-lg font-black uppercase tracking-tight">Delivery Failures</h2>
            <p className="mt-1 text-[11px] text-white/50">Падает ли notification pipeline и по кому именно.</p>
            <div className="mt-4 space-y-3">
              {snapshot.failedNotifications.length ? (
                snapshot.failedNotifications.map((item) => (
                  <div key={item.id} className="rounded-[1.35rem] border border-white/10 bg-white/[0.03] p-3">
                    <p className="text-sm font-semibold">{item.displayName}</p>
                    <p className="text-[11px] uppercase tracking-[0.18em] text-white/45">@{item.username}</p>
                    <p className="mt-2 text-[12px] text-white/70">{item.eventType}</p>
                    <p className="mt-1 text-[12px] text-white/55">{item.errorMessage || "Unknown delivery error"}</p>
                    <p className="mt-2 text-[11px] text-white/40">{formatTime(item.createdAt)}</p>
                  </div>
                ))
              ) : (
                <div className="rounded-[1.4rem] border border-dashed border-white/10 p-4 text-sm text-white/55">
                  Failed notification events не найдены.
                </div>
              )}
            </div>
          </div>
        </section>

        <section className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
          <div className="rounded-[2rem] border border-white/10 bg-black/25 p-5 backdrop-blur-xl">
            <h2 className="text-lg font-black uppercase tracking-tight">Special Statuses</h2>
            <p className="mt-1 text-[11px] text-white/50">Текущие special-card состояния и их пересечение с moderation.</p>
            <div className="mt-4 space-y-3">
              {snapshot.specialCardProfiles.length ? (
                snapshot.specialCardProfiles.map((profile) => (
                  <div key={profile.id} className="rounded-[1.35rem] border border-white/10 bg-white/[0.03] p-3">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold">{profile.displayName}</p>
                        <p className="text-[11px] uppercase tracking-[0.18em] text-white/45">@{profile.username}</p>
                      </div>
                      <span className="rounded-full border border-cyan-300/30 bg-cyan-300/10 px-3 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-cyan-100">
                        {profile.specialCard}
                      </span>
                    </div>
                    <p className="mt-2 text-[12px] text-white/55">{profile.auraPoints} aura</p>
                    {profile.activeBoostUntil ? (
                      <p className="mt-1 text-[11px] text-white/45">Boost until {formatTime(profile.activeBoostUntil)}</p>
                    ) : null}
                    {profile.moderation ? (
                      <p className="mt-1 text-[11px] text-white/45">
                        {profile.moderation.is_limited ? "limited" : "active"}
                        {profile.moderation.hide_from_discover ? " • hidden discover" : ""}
                        {profile.moderation.hide_from_leaderboards ? " • hidden LB" : ""}
                      </p>
                    ) : null}
                  </div>
                ))
              ) : (
                <div className="rounded-[1.4rem] border border-dashed border-white/10 p-4 text-sm text-white/55">
                  Активных special-card профилей нет.
                </div>
              )}
            </div>
          </div>

          <div className="rounded-[2rem] border border-white/10 bg-black/25 p-5 backdrop-blur-xl">
            <h2 className="text-lg font-black uppercase tracking-tight">Fresh Profiles</h2>
            <p className="mt-1 text-[11px] text-white/50">Новые профили, чтобы быстро смотреть onboarding и раннюю аномалию.</p>
            <div className="mt-4 space-y-3">
              {snapshot.recentProfiles.length ? (
                snapshot.recentProfiles.map((profile) => (
                  <div key={profile.id} className="rounded-[1.35rem] border border-white/10 bg-white/[0.03] p-3">
                    <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                      <div>
                        <p className="text-sm font-semibold">{profile.displayName}</p>
                        <p className="text-[11px] uppercase tracking-[0.18em] text-white/45">@{profile.username}</p>
                        <p className="mt-1 text-[12px] text-white/55">{profile.auraPoints} aura</p>
                        {profile.activeBoostUntil ? (
                          <p className="mt-1 text-[11px] text-white/45">Boost until {formatTime(profile.activeBoostUntil)}</p>
                        ) : null}
                        {profile.moderation ? (
                          <p className="mt-1 text-[11px] text-white/45">
                            {profile.moderation.is_limited ? "limited" : "visible"}
                            {profile.moderation.hide_from_discover ? " • hidden discover" : ""}
                            {profile.moderation.hide_from_leaderboards ? " • hidden LB" : ""}
                          </p>
                        ) : null}
                      </div>
                      <div className="text-[11px] text-white/40">{formatTime(profile.createdAt)}</div>
                    </div>
                    <div className="mt-4">
                      <ActionButtons
                        profileId={profile.id}
                        reason={profile.moderation?.reason || "new_profile_review"}
                        isLimited={Boolean(profile.moderation?.is_limited)}
                        hideFromDiscover={Boolean(profile.moderation?.hide_from_discover)}
                        hideFromLeaderboards={Boolean(profile.moderation?.hide_from_leaderboards)}
                      />
                    </div>
                  </div>
                ))
              ) : (
                <div className="rounded-[1.4rem] border border-dashed border-white/10 p-4 text-sm text-white/55">
                  Недавних профилей нет.
                </div>
              )}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
