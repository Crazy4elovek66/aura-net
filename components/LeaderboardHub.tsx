"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

type LeaderboardTabKey = "allTime" | "growth7d" | "growth24h" | "spotlight";

interface BaseLeader {
  id: string;
  username: string;
  displayName: string;
  auraPoints: number;
}

interface RankedLeader extends BaseLeader {
  rank: number;
}

interface GrowthLeader extends RankedLeader {
  growthPoints: number;
}

interface SpotlightLeader extends BaseLeader {
  spotlightUntil: string;
}

interface WeeklyTitle {
  key: string;
  title: string;
  description: string;
  icon: string | null;
  score: number;
  weekStart: string;
  weekEnd: string;
  profile: BaseLeader;
}

interface PersonalContext {
  profileId: string;
  username: string;
  displayName: string;
  rank: number;
  auraPoints: number;
  distanceToNext: number;
  distanceToTop10: number;
  above: BaseLeader | null;
  below: BaseLeader | null;
  aroundYou: RankedLeader[];
}

interface LeaderboardPayload {
  generatedAt: string;
  tabs: {
    allTime: RankedLeader[];
    growth7d: GrowthLeader[];
    growth24h: GrowthLeader[];
    spotlight: SpotlightLeader[];
    weeklyTitles: WeeklyTitle[];
  };
  personalContext: PersonalContext | null;
}

const TAB_LABELS: Record<LeaderboardTabKey, string> = {
  allTime: "Топ за всё время",
  growth7d: "Рост за 7 дней",
  growth24h: "Рост за 24 часа",
  spotlight: "В фокусе",
};

function formatShortDate(iso: string) {
  if (!iso) return "-";
  return new Date(iso).toLocaleString("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function LeaderboardHub() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<LeaderboardTabKey>("allTime");
  const [payload, setPayload] = useState<LeaderboardPayload | null>(null);

  useEffect(() => {
    let isMounted = true;

    const load = async () => {
      try {
        const response = await fetch("/api/leaderboard/full", { cache: "no-store" });
        const data = (await response.json()) as LeaderboardPayload & { error?: string };

        if (!response.ok) {
          throw new Error(data.error || "Не удалось загрузить лидерборд");
        }

        if (isMounted) {
          setPayload(data);
        }
      } catch (loadError) {
        if (isMounted) {
          setError(loadError instanceof Error ? loadError.message : "Ошибка загрузки");
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    void load();

    return () => {
      isMounted = false;
    };
  }, []);

  const tabRows = useMemo(() => {
    if (!payload) {
      return [] as Array<
        RankedLeader | GrowthLeader | (SpotlightLeader & { rank: number })
      >;
    }

    if (activeTab === "allTime") {
      return payload.tabs.allTime;
    }

    if (activeTab === "growth7d") {
      return payload.tabs.growth7d;
    }

    if (activeTab === "growth24h") {
      return payload.tabs.growth24h;
    }

    return payload.tabs.spotlight.map((item, index) => ({ ...item, rank: index + 1 }));
  }, [activeTab, payload]);

  if (loading) {
    return (
      <div className="w-full rounded-3xl border border-white/10 bg-black/30 backdrop-blur-md p-5 animate-pulse">
        <div className="h-5 w-48 rounded bg-white/10" />
        <div className="mt-3 h-10 w-full rounded bg-white/10" />
        <div className="mt-4 space-y-2">
          <div className="h-12 rounded-xl bg-white/10" />
          <div className="h-12 rounded-xl bg-white/10" />
          <div className="h-12 rounded-xl bg-white/10" />
        </div>
      </div>
    );
  }

  if (error || !payload) {
    return (
      <div className="w-full rounded-3xl border border-neon-pink/30 bg-neon-pink/10 p-5">
        <p className="text-xs font-black uppercase tracking-[0.12em] text-neon-pink">{error || "Лидерборд недоступен"}</p>
      </div>
    );
  }

  const my = payload.personalContext;

  return (
    <div className="w-full space-y-5">
      {my && (
        <section className="w-full rounded-3xl border border-neon-purple/30 bg-neon-purple/10 backdrop-blur-md p-5">
          <p className="text-[10px] uppercase tracking-[0.14em] text-white/60">Твоя позиция в гонке</p>
          <div className="mt-3 grid gap-3 sm:grid-cols-3">
            <div className="rounded-2xl border border-white/15 bg-black/25 p-3">
              <p className="text-[10px] uppercase tracking-[0.12em] text-white/45">Ранг</p>
              <p className="mt-1 text-xl font-black text-neon-purple">#{my.rank}</p>
            </div>
            <div className="rounded-2xl border border-white/15 bg-black/25 p-3">
              <p className="text-[10px] uppercase tracking-[0.12em] text-white/45">До следующего места</p>
              <p className="mt-1 text-xl font-black text-neon-green">+{my.distanceToNext}</p>
            </div>
            <div className="rounded-2xl border border-white/15 bg-black/25 p-3">
              <p className="text-[10px] uppercase tracking-[0.12em] text-white/45">До топ-10</p>
              <p className="mt-1 text-xl font-black text-neon-pink">{my.distanceToTop10 > 0 ? `+${my.distanceToTop10}` : "Ты в топ-10"}</p>
            </div>
          </div>

          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            {my.above ? (
              <Link
                href={`/check/${my.above.username}?returnTo=leaderboard`}
                className="rounded-2xl border border-white/15 bg-black/25 px-3 py-2 hover:border-neon-green/45 transition-colors"
              >
                <p className="text-[10px] uppercase tracking-[0.1em] text-white/45">Выше тебя</p>
                <p className="truncate text-sm text-white/90">{my.above.displayName}</p>
                <p className="text-[11px] font-black text-neon-green">{my.above.auraPoints}</p>
              </Link>
            ) : (
              <div className="rounded-2xl border border-neon-green/30 bg-neon-green/10 px-3 py-2">
                <p className="text-[10px] uppercase tracking-[0.1em] text-neon-green/80">Ты уже на вершине</p>
              </div>
            )}

            {my.below ? (
              <Link
                href={`/check/${my.below.username}?returnTo=leaderboard`}
                className="rounded-2xl border border-white/15 bg-black/25 px-3 py-2 hover:border-neon-pink/45 transition-colors"
              >
                <p className="text-[10px] uppercase tracking-[0.1em] text-white/45">Ниже тебя</p>
                <p className="truncate text-sm text-white/90">{my.below.displayName}</p>
                <p className="text-[11px] font-black text-neon-pink">{my.below.auraPoints}</p>
              </Link>
            ) : (
              <div className="rounded-2xl border border-white/15 bg-black/25 px-3 py-2">
                <p className="text-[10px] uppercase tracking-[0.1em] text-white/55">Снизу никого</p>
              </div>
            )}
          </div>
        </section>
      )}

      {payload.tabs.weeklyTitles.length > 0 && (
        <section className="w-full rounded-3xl border border-white/10 bg-black/30 backdrop-blur-md p-5">
          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-white/70">Недельные титулы</p>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            {payload.tabs.weeklyTitles.map((title) => (
              <Link
                key={`${title.key}-${title.profile.id}`}
                href={`/check/${title.profile.username}?returnTo=leaderboard`}
                className="rounded-2xl border border-white/10 bg-white/[0.03] px-3 py-2 hover:border-neon-purple/40 transition-colors"
              >
                <p className="text-[10px] uppercase tracking-[0.1em] text-neon-purple/90">{title.title}</p>
                <p className="truncate text-sm text-white/90">{title.profile.displayName}</p>
                <p className="text-[10px] text-white/55">{title.description}</p>
              </Link>
            ))}
          </div>
        </section>
      )}

      <section className="w-full rounded-3xl border border-white/10 bg-black/30 backdrop-blur-md p-5">
        <div className="flex flex-wrap gap-2">
          {(Object.keys(TAB_LABELS) as LeaderboardTabKey[]).map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => setActiveTab(tab)}
              className={[
                "rounded-xl px-3 py-2 text-[10px] font-black uppercase tracking-[0.12em] border transition-colors",
                activeTab === tab
                  ? "border-neon-purple/50 bg-neon-purple/15 text-neon-purple"
                  : "border-white/15 bg-white/[0.03] text-white/60 hover:text-white",
              ].join(" ")}
            >
              {TAB_LABELS[tab]}
            </button>
          ))}
        </div>

        <div className="mt-4 space-y-2">
          {tabRows.map((row) => {
            const growth =
              "growthPoints" in row && typeof row.growthPoints === "number" ? row.growthPoints : null;
            const isSpotlight = activeTab === "spotlight";
            const spotlightUntil =
              "spotlightUntil" in row && typeof row.spotlightUntil === "string" ? row.spotlightUntil : null;

            return (
              <Link
                key={`${activeTab}-${row.id}-${row.rank}`}
                href={`/check/${row.username}?returnTo=leaderboard`}
                className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/[0.02] px-3 py-2 hover:border-neon-purple/40 transition-colors"
              >
                <div className="min-w-0 pr-3">
                  <p className="truncate text-sm text-white/90">
                    <span className="mr-2 text-white/45">#{row.rank}</span>
                    {row.displayName}
                  </p>
                  {isSpotlight && spotlightUntil ? (
                    <p className="text-[10px] uppercase tracking-[0.08em] text-white/45">до {formatShortDate(spotlightUntil)} UTC+0</p>
                  ) : null}
                </div>
                <div className="text-right">
                  <p className="text-sm font-black text-neon-green">{row.auraPoints}</p>
                  {growth !== null ? <p className="text-[10px] font-black text-neon-pink">+{growth}</p> : null}
                </div>
              </Link>
            );
          })}

          {!tabRows.length && (
            <p className="rounded-2xl border border-white/10 bg-white/[0.02] px-3 py-2 text-[11px] text-white/60">
              Пока нет данных для этой вкладки.
            </p>
          )}
        </div>

        <p className="mt-3 text-[10px] uppercase tracking-[0.08em] text-white/40">
          Обновлено: {formatShortDate(payload.generatedAt)} UTC+0
        </p>
      </section>
    </div>
  );
}
