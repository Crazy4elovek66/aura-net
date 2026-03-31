"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

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
  const router = useRouter();
  const [state, setState] = useState(initialState);
  const [loading, setLoading] = useState(false);
  const [lastClaimReward, setLastClaimReward] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const capReached = useMemo(() => state.nextReward >= 50, [state.nextReward]);

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
        setError(data.error || "Не удалось получить daily reward");
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

      router.refresh();
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
          <h2 className="text-[10px] font-black uppercase tracking-[0.2em] text-white/70">Daily reward</h2>
          <p className="text-xs text-white/60 mt-1">Текущая серия: {state.streak} дн.</p>
        </div>
        <div className="text-right">
          <p className="text-[10px] uppercase tracking-[0.12em] text-white/40">Следующий бонус</p>
          <p className="text-sm font-black text-neon-green">
            +{state.nextReward} {capReached ? "😎" : ""}
          </p>
        </div>
      </div>

      <div className="mt-4 rounded-2xl border border-white/10 bg-white/[0.02] p-4">
        <p className="text-[11px] text-white/75">
          {state.canClaim
            ? `Доступно сейчас: +${state.rewardToday} ауры`
            : `Следующий claim после ${formatDate(state.availableAt)} (UTC+0)`}
        </p>

        {state.streakWillReset && state.canClaim && (
          <p className="mt-2 text-[10px] text-neon-pink/90 uppercase tracking-[0.08em]">
            Серия была прервана, после claim начнется заново.
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
          disabled={!state.canClaim || loading}
          className="mt-4 w-full rounded-xl border border-neon-green/40 bg-neon-green/10 py-3 text-[10px] font-black uppercase tracking-[0.15em] text-neon-green transition-all disabled:cursor-not-allowed disabled:opacity-50"
        >
          {loading ? "Получаем..." : state.canClaim ? `Забрать +${state.rewardToday}` : "Уже получено сегодня"}
        </button>
      </div>
    </section>
  );
}
