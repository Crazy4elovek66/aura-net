"use client";

import {
  CARD_ACCENT_COST,
  CARD_ACCENT_VARIANTS,
  DECAY_SHIELD_COST,
  SPOTLIGHT_COST,
  STREAK_RESCUE_COST,
} from "@/lib/economy";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

interface AuraSpendActionsCardProps {
  profileId: string;
  initialState: {
    streak: number;
    decayShieldUntil: string | null;
    spotlightUntil: string | null;
    cardAccent: string | null;
    cardAccentUntil: string | null;
    canRescueStreak: boolean;
    rescueAvailableAt: string | null;
  };
}

type PendingAction = "decay_shield" | "streak_save" | "spotlight" | "card_accent" | null;

const ACCENT_LABELS: Record<string, string> = {
  NEON_EDGE: "Неоновая грань",
  GOLD_PULSE: "Золотой импульс",
  FROST_RING: "Ледяной контур",
};

function formatDate(iso: string | null) {
  if (!iso) return "-";

  return new Date(iso).toLocaleString("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function isActive(iso: string | null) {
  return Boolean(iso);
}

export default function AuraSpendActionsCard({ profileId, initialState }: AuraSpendActionsCardProps) {
  const router = useRouter();

  const [pendingAction, setPendingAction] = useState<PendingAction>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const shieldActive = useMemo(() => isActive(initialState.decayShieldUntil), [initialState.decayShieldUntil]);
  const spotlightActive = useMemo(() => isActive(initialState.spotlightUntil), [initialState.spotlightUntil]);
  const accentActive = useMemo(() => isActive(initialState.cardAccentUntil), [initialState.cardAccentUntil]);

  const runAction = async (action: PendingAction, variant?: string) => {
    if (!action || pendingAction) return;

    setPendingAction(action);
    setError(null);
    setSuccess(null);

    try {
      if (action === "spotlight") {
        const response = await fetch("/api/boost", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ profileId }),
        });

        const payload = (await response.json().catch(() => ({}))) as { error?: string };

        if (!response.ok) {
          setError(payload.error || "Не удалось включить фокус");
          return;
        }

        setSuccess("Фокус активирован");
        router.refresh();
        return;
      }

      const response = await fetch("/api/aura-actions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, variant }),
      });

      const payload = (await response.json().catch(() => ({}))) as { error?: string };

      if (!response.ok) {
        setError(payload.error || "Не удалось выполнить трату");
        return;
      }

      if (action === "decay_shield") {
        setSuccess("Щит от угасания активирован");
      } else if (action === "streak_save") {
        setSuccess("Серия сохранена. Можно забирать дейлик без сброса.");
      } else {
        setSuccess("Визуальный акцент активирован");
      }

      router.refresh();
    } catch {
      setError("Сетевая ошибка. Попробуй снова.");
    } finally {
      setPendingAction(null);
    }
  };

  return (
    <section className="w-full max-w-xl rounded-3xl border border-white/10 bg-black/30 backdrop-blur-md p-5">
      <h2 className="text-[10px] font-black uppercase tracking-[0.2em] text-white/70">Траты ауры</h2>
      <p className="mt-1 text-[11px] text-white/45">Осмысленные действия с лимитами и сроком действия.</p>

      <div className="mt-4 space-y-3">
        <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-3">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.12em] text-white/80">Щит от угасания (24ч)</p>
              <p className="text-[10px] text-white/50">
                {shieldActive
                  ? `Активен до ${formatDate(initialState.decayShieldUntil)} (UTC+0)`
                  : "Блокирует ежедневное угасание на ограниченное время."}
              </p>
            </div>
            <button
              type="button"
              onClick={() => runAction("decay_shield")}
              disabled={pendingAction !== null || shieldActive}
              className="rounded-xl border border-neon-green/40 px-3 py-2 text-[10px] font-black uppercase tracking-[0.15em] text-neon-green disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {pendingAction === "decay_shield" ? "..." : `-${DECAY_SHIELD_COST}`}
            </button>
          </div>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-3">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.12em] text-white/80">Сохранение серии</p>
              <p className="text-[10px] text-white/50">
                {initialState.canRescueStreak
                  ? `Доступно сейчас. Текущая серия: ${initialState.streak} дн.`
                  : initialState.rescueAvailableAt
                    ? `Перезарядка до ${formatDate(initialState.rescueAvailableAt)} (UTC+0)`
                    : "Доступно только при 1 пропущенном дне и активной серии."}
              </p>
            </div>
            <button
              type="button"
              onClick={() => runAction("streak_save")}
              disabled={pendingAction !== null || !initialState.canRescueStreak}
              className="rounded-xl border border-neon-purple/40 px-3 py-2 text-[10px] font-black uppercase tracking-[0.15em] text-neon-purple disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {pendingAction === "streak_save" ? "..." : `-${STREAK_RESCUE_COST}`}
            </button>
          </div>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-3">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.12em] text-white/80">Фокус (15 мин)</p>
              <p className="text-[10px] text-white/50">
                {spotlightActive
                  ? `Активен до ${formatDate(initialState.spotlightUntil)} (UTC+0)`
                  : "Временная видимость профиля в отдельном блоке лидерборда."}
              </p>
            </div>
            <button
              type="button"
              onClick={() => runAction("spotlight")}
              disabled={pendingAction !== null || spotlightActive}
              className="rounded-xl border border-neon-pink/40 px-3 py-2 text-[10px] font-black uppercase tracking-[0.15em] text-neon-pink disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {pendingAction === "spotlight" ? "..." : `-${SPOTLIGHT_COST}`}
            </button>
          </div>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-3">
          <p className="text-[10px] font-black uppercase tracking-[0.12em] text-white/80">Временный акцент карточки (24ч)</p>
          <p className="mt-1 text-[10px] text-white/50">
            {accentActive
              ? `Активен: ${ACCENT_LABELS[initialState.cardAccent || ""] || initialState.cardAccent} до ${formatDate(initialState.cardAccentUntil)} (UTC+0)`
              : "Один контролируемый визуальный эффект без хаоса в стиле."}
          </p>
          <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-3">
            {CARD_ACCENT_VARIANTS.map((variant) => (
              <button
                key={variant}
                type="button"
                onClick={() => runAction("card_accent", variant)}
                disabled={pendingAction !== null || accentActive}
                className="rounded-xl border border-white/15 bg-white/[0.02] px-2 py-2 text-[10px] font-black uppercase tracking-[0.08em] text-white/80 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {pendingAction === "card_accent" ? "..." : `${ACCENT_LABELS[variant]} • -${CARD_ACCENT_COST}`}
              </button>
            ))}
          </div>
        </div>
      </div>

      {success && <p className="mt-3 text-[10px] uppercase tracking-[0.08em] text-neon-green">{success}</p>}
      {error && <p className="mt-3 text-[10px] uppercase tracking-[0.08em] text-neon-pink">{error}</p>}
    </section>
  );
}

