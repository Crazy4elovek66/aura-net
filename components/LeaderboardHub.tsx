"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import InlineStateCard from "@/components/ux/InlineStateCard";

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

interface NearTierLeader extends RankedLeader {
  tierLabel: string;
  pointsToTier: number;
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
  returnPulse: {
    trackedAt: string | null;
    previousRank: number | null;
    auraDelta: number;
    newAchievements: number;
    newMoments: number;
    pendingEvents: number;
  } | null;
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
  live: {
    cutlineTop10: RankedLeader[];
    nearTier: NearTierLeader[];
  };
  personalContext: PersonalContext | null;
}

const TAB_LABELS: Record<LeaderboardTabKey, string> = {
  allTime: "Топ за всё время",
  growth7d: "Рост за 7 дней",
  growth24h: "Рост за 24 часа",
  spotlight: "В фокусе",
};

function formatShortDate(iso: string | null) {
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
  const [reloadToken, setReloadToken] = useState(0);

  useEffect(() => {
    let isMounted = true;

    const load = async () => {
      setLoading(true);
      setError(null);

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
          setPayload(null);
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
  }, [reloadToken]);

  const tabRows = useMemo(() => {
    if (!payload) {
      return [] as Array<RankedLeader | GrowthLeader | (SpotlightLeader & { rank: number })>;
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
      <InlineStateCard
        eyebrow="Лидерборд"
        title="Загружаем гонку ауры"
        description="Собираем места, рост, линию топ-10 и твой персональный контекст."
      />
    );
  }

  if (error || !payload) {
    return (
      <InlineStateCard
        eyebrow="Лидерборд"
        title="Лидерборд временно недоступен"
        description={error || "Не удалось загрузить таблицу лидеров."}
        tone="error"
        actionLabel="Повторить"
        onAction={() => setReloadToken((current) => current + 1)}
      />
    );
  }

  const my = payload.personalContext;
  const rankShift =
    my?.returnPulse?.previousRank && my.rank ? my.returnPulse.previousRank - my.rank : null;

  return (
    <div className="w-full space-y-5">
      {my ? (
        <section className="w-full rounded-3xl border border-neon-purple/30 bg-neon-purple/10 backdrop-blur-md p-5">
          <p className="text-[10px] uppercase tracking-[0.14em] text-white/60">Твоя позиция в гонке</p>
          <div className="mt-3 grid gap-3 sm:grid-cols-3">
            <div className="rounded-2xl border border-white/15 bg-black/25 p-3">
              <p className="text-[10px] uppercase tracking-[0.12em] text-white/45">Ранг</p>
              <p className="mt-1 text-xl font-black text-neon-purple">#{my.rank}</p>
            </div>
            <div className="rounded-2xl border border-white/15 bg-black/25 p-3">
              <p className="text-[10px] uppercase tracking-[0.12em] text-white/45">До следующего места</p>
              <p className="mt-1 text-xl font-black text-neon-green">
                {my.distanceToNext > 0 ? `+${my.distanceToNext}` : "обгон"}
              </p>
            </div>
            <div className="rounded-2xl border border-white/15 bg-black/25 p-3">
              <p className="text-[10px] uppercase tracking-[0.12em] text-white/45">До топ-10</p>
              <p className="mt-1 text-xl font-black text-neon-pink">
                {my.distanceToTop10 > 0 ? `+${my.distanceToTop10}` : "ты в топ-10"}
              </p>
            </div>
          </div>

          {my.returnPulse ? (
            <div className="mt-3 rounded-2xl border border-white/15 bg-black/25 p-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-[10px] uppercase tracking-[0.1em] text-white/45">Что изменилось с прошлого захода</p>
                  <p className="mt-1 text-[11px] text-white/65">
                    Точка отсчёта: {formatShortDate(my.returnPulse.trackedAt)} UTC+0
                  </p>
                </div>
                <div className="flex flex-wrap gap-2 text-[10px] font-black uppercase tracking-[0.08em]">
                  <span className={`rounded-full border px-2.5 py-1 ${my.returnPulse.auraDelta >= 0 ? "border-neon-green/30 bg-neon-green/10 text-neon-green" : "border-neon-pink/30 bg-neon-pink/10 text-neon-pink"}`}>
                    aura {my.returnPulse.auraDelta >= 0 ? `+${my.returnPulse.auraDelta}` : my.returnPulse.auraDelta}
                  </span>
                  <span className="rounded-full border border-white/15 bg-white/[0.03] px-2.5 py-1 text-white/80">
                    {rankShift === null ? "ранг без истории" : rankShift > 0 ? `ранг +${rankShift}` : rankShift < 0 ? `ранг ${rankShift}` : "ранг без смены"}
                  </span>
                  <span className="rounded-full border border-white/15 bg-white/[0.03] px-2.5 py-1 text-white/80">
                    моментов {my.returnPulse.newMoments}
                  </span>
                  <span className="rounded-full border border-white/15 bg-white/[0.03] px-2.5 py-1 text-white/80">
                    достижений {my.returnPulse.newAchievements}
                  </span>
                </div>
              </div>
            </div>
          ) : null}

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
              <InlineStateCard title="Ты уже на вершине" description="Выше тебя сейчас никого нет." tone="warning" />
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
              <InlineStateCard title="Снизу пока никого" description="Рядом с твоей позицией сейчас нет следующего профиля." />
            )}
          </div>

          {my.aroundYou.length > 0 ? (
            <div className="mt-3 rounded-2xl border border-white/15 bg-black/25 p-3">
              <p className="text-[10px] uppercase tracking-[0.1em] text-white/45">Локальный срез вокруг тебя</p>
              <div className="mt-2 space-y-2">
                {my.aroundYou.map((profile) => (
                  <Link
                    key={`${profile.id}-${profile.rank}`}
                    href={`/check/${profile.username}?returnTo=leaderboard`}
                    className={`flex items-center justify-between rounded-xl border px-3 py-2 transition-colors hover:border-neon-purple/35 ${
                      profile.id === my.profileId ? "border-neon-purple/35 bg-neon-purple/10" : "border-white/10 bg-white/[0.02]"
                    }`}
                  >
                    <p className="truncate pr-3 text-[11px] text-white/85">
                      <span className="mr-2 text-white/45">#{profile.rank}</span>
                      {profile.displayName}
                    </p>
                    <p className="text-[11px] font-black text-white">{profile.auraPoints}</p>
                  </Link>
                ))}
              </div>
            </div>
          ) : null}
        </section>
      ) : (
        <InlineStateCard
          eyebrow="Лидерборд"
          title="Личный контекст пока недоступен"
          description="Без полноценной сессии или достаточного объёма данных персональная гонка не считается."
        />
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

      <section className="grid gap-5 lg:grid-cols-2">
        <div className="rounded-3xl border border-white/10 bg-black/30 backdrop-blur-md p-5">
          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-white/70">Линия топ-10</p>
          <div className="mt-3 space-y-2">
            {payload.live.cutlineTop10.map((profile) => (
              <Link
                key={`${profile.id}-${profile.rank}`}
                href={`/check/${profile.username}?returnTo=leaderboard`}
                className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/[0.02] px-3 py-2 hover:border-neon-purple/40 transition-colors"
              >
                <p className="truncate pr-3 text-sm text-white/90">
                  <span className="mr-2 text-white/45">#{profile.rank}</span>
                  {profile.displayName}
                </p>
                <p className="text-sm font-black text-white">{profile.auraPoints}</p>
              </Link>
            ))}
          </div>
        </div>

        <div className="rounded-3xl border border-white/10 bg-black/30 backdrop-blur-md p-5">
          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-white/70">Почти новый tier</p>
          <div className="mt-3 space-y-2">
            {payload.live.nearTier.map((profile) => (
              <Link
                key={`${profile.id}-${profile.rank}`}
                href={`/check/${profile.username}?returnTo=leaderboard`}
                className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/[0.02] px-3 py-2 hover:border-neon-purple/40 transition-colors"
              >
                <div className="min-w-0 pr-3">
                  <p className="truncate text-sm text-white/90">
                    <span className="mr-2 text-white/45">#{profile.rank}</span>
                    {profile.displayName}
                  </p>
                  <p className="text-[10px] uppercase tracking-[0.08em] text-white/45">
                    до {profile.tierLabel} осталось +{profile.pointsToTier}
                  </p>
                </div>
                <p className="text-sm font-black text-neon-green">{profile.auraPoints}</p>
              </Link>
            ))}
          </div>
        </div>
      </section>

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
          {tabRows.length ? (
            tabRows.map((row) => {
              const growth = "growthPoints" in row && typeof row.growthPoints === "number" ? row.growthPoints : null;
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
                      <p className="text-[10px] uppercase tracking-[0.08em] text-white/45">
                        до {formatShortDate(spotlightUntil)} UTC+0
                      </p>
                    ) : null}
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-black text-neon-green">{row.auraPoints}</p>
                    {growth !== null ? <p className="text-[10px] font-black text-neon-pink">+{growth}</p> : null}
                  </div>
                </Link>
              );
            })
          ) : (
            <InlineStateCard
              title="Для этой вкладки пока нет данных"
              description="Как только в системе накопится активность по выбранному срезу, список появится здесь."
            />
          )}
        </div>

        <p className="mt-3 text-[10px] uppercase tracking-[0.08em] text-white/40">
          Обновлено: {formatShortDate(payload.generatedAt)} UTC+0
        </p>
      </section>
    </div>
  );
}
