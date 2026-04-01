"use client";

import { useMemo, useState } from "react";

export interface DailyRewardInitialState {
  canClaim: boolean;
  claimedToday: boolean;
  streak: number;
  rewardToday: number;
  nextReward: number;
  availableAt: string;
  streakWillReset: boolean;
}

interface DailyRewardCardProps {
  initialState: DailyRewardInitialState;
}

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
  const [state, setState] = useState(initialState);
  const [loading, setLoading] = useState(false);
  const [lastClaimReward, setLastClaimReward] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const capReached = useMemo(() => state.nextReward >= 50, [state.nextReward]);
  const isClaimed = !state.canClaim;

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
      };

      if (!response.ok) {
        setError(data.error || "Не удалось получить ежедневную награду");
        return;
      }

      if (data.claimed) {
        const reward = Number(data.reward || 0);
        const streak = Number(data.streak || 0);
        const nextReward = Number(data.nextReward || 0);

        setLastClaimReward(reward);
        setState({
          canClaim: false,
          claimedToday: true,
          streak,
          rewardToday: 0,
          nextReward,
          availableAt: data.availableAt || state.availableAt,
          streakWillReset: false,
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
      setError("Сетевая ошибка. Попробуй еще раз.");
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
        </div>
        <div className="text-right">
          <p className="text-[10px] uppercase tracking-[0.12em] text-white/40">Следующая награда</p>
          <p className="text-sm font-black text-neon-green">
            +{state.nextReward} {capReached ? "😎" : ""}
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
            Серия прервана: после получения начнется с первого дня.
          </p>
        )}

        {lastClaimReward !== null && (
          <p className="mt-2 text-[10px] text-neon-green uppercase tracking-[0.08em]">
            Получено: +{lastClaimReward} ауры
          </p>
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
          {loading ? "Начисляем награду..." : state.canClaim ? `Забрать +${state.rewardToday} ауры` : "Получено сегодня"}
        </button>
      </div>
    </section>
  );
}
