"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { DAILY_REWARD_CAP } from "@/lib/economy";

export interface DailyRewardInitialState {
  canClaim: boolean;
  claimedToday: boolean;
  streak: number;
  projectedStreak?: number;
  rewardToday: number;
  nextReward: number;
  availableAt: string;
  streakWillReset: boolean;
  weeklyProgressDays?: number;
  weeklyTargetDays?: number;
}

interface DailyRewardCardProps {
  initialState: DailyRewardInitialState;
}

interface ClaimBreakdown {
  total: number;
  base: number;
  bonus: number;
  streakMilestone: number;
  weeklyActivity: number;
  achievements: number;
  unlockedAchievements: string[];
}

const STREAK_MILESTONES = [3, 7, 14, 30];

function formatDate(iso: string) {
  if (!iso) return "-";
  return new Date(iso).toLocaleString("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function DailyRewardCard({ initialState }: DailyRewardCardProps) {
  const router = useRouter();
  const [state, setState] = useState(initialState);
  const [loading, setLoading] = useState(false);
  const [lastClaim, setLastClaim] = useState<ClaimBreakdown | null>(null);
  const [error, setError] = useState<string | null>(null);
  const refreshTimeoutRef = useRef<number | null>(null);

  const capReached = useMemo(() => state.nextReward >= DAILY_REWARD_CAP, [state.nextReward]);
  const isClaimed = !state.canClaim;
  const projectedStreak = useMemo(
    () => Math.max(state.projectedStreak ?? (state.canClaim ? state.streak + 1 : state.streak), state.streak),
    [state.projectedStreak, state.canClaim, state.streak],
  );
  const nextMilestone = useMemo(
    () => STREAK_MILESTONES.find((milestone) => milestone >= projectedStreak) ?? STREAK_MILESTONES[STREAK_MILESTONES.length - 1],
    [projectedStreak],
  );
  const toNextMilestone = Math.max(nextMilestone - projectedStreak, 0);
  const weeklyTarget = Math.max(1, Math.floor(state.weeklyTargetDays || 5));
  const weeklyProgress = Math.min(Math.max(0, Math.floor(state.weeklyProgressDays || 0)), weeklyTarget);
  const weeklyProgressPercent = Math.round((weeklyProgress / weeklyTarget) * 100);

  useEffect(() => {
    setState(initialState);
  }, [initialState]);

  useEffect(() => {
    return () => {
      if (refreshTimeoutRef.current !== null) {
        window.clearTimeout(refreshTimeoutRef.current);
      }
    };
  }, []);

  const handleClaim = async () => {
    if (!state.canClaim || loading) return;

    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/daily-reward", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });

      const data = (await response.json()) as {
        error?: string;
        claimed?: boolean;
        reward?: number;
        streak?: number;
        nextReward?: number;
        availableAt?: string | null;
        baseReward?: number;
        bonusReward?: number;
        bonuses?: {
          streakMilestone?: number;
          weeklyActivity?: number;
          achievements?: number;
        };
        unlockedAchievements?: string[];
      };

      if (!response.ok) {
        setError(data.error || "Не удалось получить ежедневную награду");
        return;
      }

      if (data.claimed) {
        const reward = Number(data.reward || 0);
        const streak = Number(data.streak || 0);
        const nextReward = Number(data.nextReward || 0);

        setLastClaim({
          total: reward,
          base: Number(data.baseReward || reward),
          bonus: Number(data.bonusReward || 0),
          streakMilestone: Number(data.bonuses?.streakMilestone || 0),
          weeklyActivity: Number(data.bonuses?.weeklyActivity || 0),
          achievements: Number(data.bonuses?.achievements || 0),
          unlockedAchievements: Array.isArray(data.unlockedAchievements) ? data.unlockedAchievements : [],
        });

        setState({
          canClaim: false,
          claimedToday: true,
          streak,
          projectedStreak: streak + 1,
          rewardToday: 0,
          nextReward,
          availableAt: data.availableAt || state.availableAt,
          streakWillReset: false,
          weeklyProgressDays: Math.min((state.weeklyProgressDays || 0) + 1, weeklyTarget),
          weeklyTargetDays: weeklyTarget,
        });

        if (refreshTimeoutRef.current !== null) {
          window.clearTimeout(refreshTimeoutRef.current);
        }

        refreshTimeoutRef.current = window.setTimeout(() => {
          router.refresh();
        }, 300);
      } else {
        setState((prev) => ({
          ...prev,
          canClaim: false,
          claimedToday: true,
          availableAt: data.availableAt || prev.availableAt,
        }));
      }
    } catch {
      setError("Сетевая ошибка. Попробуй снова.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="w-full max-w-xl rounded-3xl border border-white/10 bg-black/30 backdrop-blur-md p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-[10px] font-black uppercase tracking-[0.2em] text-white/70">Ежедневная награда</h2>
          <p className="text-[11px] text-white/45 mt-1 uppercase tracking-[0.08em]">Серия: {state.streak} дн.</p>
          <p className="text-[10px] text-white/50 mt-1 uppercase tracking-[0.08em]">
            Следующий рубеж: {nextMilestone} дн. {toNextMilestone > 0 ? `(+${toNextMilestone})` : "достигнут"}
          </p>
        </div>
        <div className="text-right">
          <p className="text-[10px] uppercase tracking-[0.12em] text-white/40">Следующая награда</p>
          <p className="text-sm font-black text-neon-green">
            +{state.nextReward} {capReached ? "макс" : ""}
          </p>
        </div>
      </div>

      <div className="mt-4 rounded-2xl border border-white/10 bg-white/[0.02] p-4">
        <p className="text-[11px] text-white/75">
          {state.canClaim
            ? `Сейчас можно забрать +${state.rewardToday} ауры`
            : `Следующая выдача: ${formatDate(state.availableAt)} (UTC+0)`}
        </p>

        {state.streakWillReset && state.canClaim && (
          <p className="mt-2 text-[10px] text-neon-pink/90 uppercase tracking-[0.08em]">
            Серия прервана. После получения начнется с первого дня.
          </p>
        )}

        <div className="mt-3 rounded-xl border border-white/10 bg-black/25 p-3">
          <p className="text-[10px] uppercase tracking-[0.1em] text-white/50">Этапы серии</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {STREAK_MILESTONES.map((milestone) => {
              const reached = state.streak >= milestone;
              const isNext = !reached && milestone === nextMilestone;

              return (
                <span
                  key={milestone}
                  className={[
                    "rounded-full border px-2.5 py-1 text-[9px] font-black uppercase tracking-[0.1em]",
                    reached
                      ? "border-neon-green/45 bg-neon-green/10 text-neon-green"
                      : isNext
                        ? "border-neon-purple/45 bg-neon-purple/10 text-neon-purple"
                        : "border-white/15 bg-white/[0.03] text-white/55",
                  ].join(" ")}
                >
                  {milestone} дн.
                </span>
              );
            })}
          </div>
        </div>

        <div className="mt-3 rounded-xl border border-white/10 bg-black/25 p-3">
          <div className="flex items-center justify-between gap-2">
            <p className="text-[10px] uppercase tracking-[0.1em] text-white/50">Недельный цикл</p>
            <p className="text-[10px] font-black uppercase tracking-[0.1em] text-neon-pink">
              {weeklyProgress}/{weeklyTarget}
            </p>
          </div>
          <div className="mt-2 h-1.5 rounded-full bg-white/10 overflow-hidden">
            <div className="h-full bg-neon-pink transition-all duration-300" style={{ width: `${weeklyProgressPercent}%` }} />
          </div>
          <p className="mt-2 text-[10px] uppercase tracking-[0.08em] text-white/50">
            {weeklyProgress >= weeklyTarget
              ? "Недельная цель закрыта. Забирай награду серии ежедневно."
              : `До недельного бонуса: ещё ${weeklyTarget - weeklyProgress} дней входа.`}
          </p>
        </div>

        {lastClaim && (
          <div className="mt-2 space-y-1">
            <p className="text-[10px] text-neon-green uppercase tracking-[0.08em]">Получено: +{lastClaim.total} ауры</p>
            {lastClaim.bonus > 0 && (
              <p className="text-[10px] text-white/75 uppercase tracking-[0.08em]">Бонусы активности: +{lastClaim.bonus}</p>
            )}
            {lastClaim.streakMilestone > 0 && (
              <p className="text-[10px] text-white/60 uppercase tracking-[0.08em]">Этап серии: +{lastClaim.streakMilestone}</p>
            )}
            {lastClaim.weeklyActivity > 0 && (
              <p className="text-[10px] text-white/60 uppercase tracking-[0.08em]">Недельная активность: +{lastClaim.weeklyActivity}</p>
            )}
            {lastClaim.achievements > 0 && (
              <p className="text-[10px] text-white/60 uppercase tracking-[0.08em]">Достижения: +{lastClaim.achievements}</p>
            )}
            {lastClaim.unlockedAchievements.length > 0 && (
              <p className="text-[10px] text-neon-purple uppercase tracking-[0.08em]">
                Открыто: {lastClaim.unlockedAchievements.join(" | ")}
              </p>
            )}
          </div>
        )}

        {error && <p className="mt-2 text-[10px] text-neon-pink uppercase tracking-[0.08em]">{error}</p>}

        <button
          type="button"
          onClick={handleClaim}
          disabled={isClaimed || loading}
          className={[
            "mt-4 w-full rounded-2xl border-2 py-3.5 text-[10px] font-black uppercase tracking-[0.2em] transition-all active:scale-[0.98]",
            isClaimed
              ? "cursor-not-allowed border-neon-purple/30 bg-neon-purple/10 text-neon-purple/90 shadow-[0_0_16px_rgba(180,74,255,0.14)]"
              : "border-neon-green/45 bg-neon-green/10 text-neon-green shadow-[0_0_20px_rgba(57,255,20,0.16)] hover:-translate-y-[1px] hover:border-neon-green/65 hover:bg-neon-green/15 hover:shadow-[0_0_26px_rgba(57,255,20,0.22)]",
            loading ? "cursor-wait" : "",
          ].join(" ")}
        >
          {loading ? "Начисляем..." : state.canClaim ? `Забрать +${state.rewardToday} ауры` : "Получено сегодня"}
        </button>
      </div>
    </section>
  );
}
