"use client";

import { startTransition, useEffect, useMemo, useState } from "react";
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


export default function DailyRewardCard({ initialState }: DailyRewardCardProps) {
  const router = useRouter();
  const [state, setState] = useState(initialState);
  const [loading, setLoading] = useState(false);
  const [lastClaim, setLastClaim] = useState<ClaimBreakdown | null>(null);
  const [error, setError] = useState<string | null>(null);

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

        startTransition(() => {
          router.refresh();
        });
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
    <section id="daily-reward-card" className="w-full max-w-xl rounded-3xl border border-white/10 bg-black/30 backdrop-blur-md p-4">
      {/* Шапка: Серия, награда и следующий бонус */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="text-[10px] font-black uppercase tracking-[0.2em] text-white/70">Награда дня</h2>
          <div className="flex items-center gap-2 mt-0.5">
            <span className="text-[10px] text-white/45 uppercase tracking-[0.08em]">Серия: {state.streak} дн.</span>
            <span className="text-[10px] text-white/30">•</span>
            <span className="text-[9px] text-white/40 uppercase tracking-[0.08em]">
              Рубеж: {nextMilestone} дн. {toNextMilestone > 0 ? `(+${toNextMilestone})` : ""}
            </span>
          </div>
        </div>
        <div className="text-right">
          <span className="text-[9px] uppercase tracking-[0.12em] text-white/40 block">Бонус завтра</span>
          <span className="text-xs font-black text-neon-green">
            +{state.nextReward} {capReached ? "макс" : ""}
          </span>
        </div>
      </div>

      {/* Компактный контент */}
      <div className="mt-2.5 pt-2.5 border-t border-white/[0.04] flex flex-col gap-2">
        {/* Недельный прогресс */}
        <div className="flex flex-col gap-1">
          <div className="flex justify-between items-center text-[9px] uppercase tracking-[0.08em] text-white/40">
            <span>Цель недели: {weeklyProgress}/{weeklyTarget} дн.</span>
            {weeklyProgress >= weeklyTarget && <span className="text-neon-pink">Бонус готов</span>}
          </div>
          <div className="h-[2px] w-full rounded-full bg-white/10 overflow-hidden">
            <div className="h-full bg-neon-pink transition-all duration-300" style={{ width: `${weeklyProgressPercent}%` }} />
          </div>
        </div>

        {/* Уведомления об ошибках и сбросах */}
        {state.streakWillReset && state.canClaim && (
          <p className="text-[9px] text-neon-pink/90 uppercase tracking-[0.08em]">
            Внимание: сегодня последний шанс продлить серию!
          </p>
        )}

        {lastClaim && (
          <div className="text-[9px] text-white/40 uppercase tracking-[0.08em] flex flex-wrap gap-x-2 gap-y-0.5">
            <span className="text-neon-green font-bold">Получено: +{lastClaim.total}</span>
            {lastClaim.bonus > 0 && <span>(активность +{lastClaim.bonus})</span>}
            {lastClaim.streakMilestone > 0 && <span>(рубеж +{lastClaim.streakMilestone})</span>}
            {lastClaim.weeklyActivity > 0 && <span>(неделя +{lastClaim.weeklyActivity})</span>}
          </div>
        )}

        {error && <p className="text-[9px] text-neon-pink uppercase tracking-[0.08em]">{error}</p>}

        {/* Кнопка получения */}
        <button
          type="button"
          onClick={handleClaim}
          disabled={isClaimed || loading}
          className={[
            "w-full rounded-xl border py-2 text-[9px] font-black uppercase tracking-[0.2em] transition-all active:scale-[0.98]",
            isClaimed
              ? "cursor-not-allowed border-white/5 bg-white/[0.02] text-white/30"
              : "border-neon-green/45 bg-neon-green/10 text-neon-green shadow-[0_0_16px_rgba(57,255,20,0.1)] hover:border-neon-green/65 hover:bg-neon-green/15",
            loading ? "cursor-wait" : "",
          ].join(" ")}
        >
          {loading ? "Начисляем..." : state.canClaim ? `Забрать +${state.rewardToday} ауры` : "Награда уже получена"}
        </button>
      </div>
    </section>
  );
}
