"use client";

import {
  CARD_ACCENT_COST,
  CARD_ACCENT_VARIANTS,
  DECAY_SHIELD_COST,
  SPOTLIGHT_COST,
  STREAK_RESCUE_COST,
} from "@/lib/economy";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, useTransition } from "react";
import { useNotice } from "@/components/notice/NoticeProvider";

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
  return Boolean(iso && new Date(iso).getTime() > Date.now());
}

function getAccentPreviewClass(variant: string) {
  switch (variant) {
    case "NEON_EDGE":
      return "border-fuchsia-300/80 shadow-[0_0_20px_rgba(232,121,249,0.45)]";
    case "GOLD_PULSE":
      return "border-amber-300/80 shadow-[0_0_20px_rgba(252,211,77,0.45)]";
    case "FROST_RING":
      return "border-cyan-300/80 shadow-[0_0_20px_rgba(103,232,249,0.45)]";
    default:
      return "border-white/20";
  }
}

export default function AuraSpendActionsCard({ profileId, initialState }: AuraSpendActionsCardProps) {
  const router = useRouter();
  const { notify } = useNotice();
  const [pendingAction, setPendingAction] = useState<PendingAction>(null);
  const [state, setState] = useState(initialState);
  const [isRefreshing, startRefreshTransition] = useTransition();
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);

  useEffect(() => {
    setState(initialState);
  }, [initialState]);

  const shieldActive = useMemo(() => isActive(state.decayShieldUntil), [state.decayShieldUntil]);
  const spotlightActive = useMemo(() => isActive(state.spotlightUntil), [state.spotlightUntil]);
  const accentActive = useMemo(() => isActive(state.cardAccentUntil), [state.cardAccentUntil]);
  const actionLocked = pendingAction !== null || isRefreshing;

  const runAction = async (action: PendingAction, variant?: string) => {
    if (!action || actionLocked) return;

    setPendingAction(action);

    try {
      if (action === "spotlight") {
        const response = await fetch("/api/boost", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ profileId }),
        });

        const payload = (await response.json().catch(() => ({}))) as {
          error?: string;
          expiresAt?: string | null;
        };

        if (!response.ok) {
          notify({
            variant: "error",
            title: "Фокус не включён",
            message: payload.error || "Не удалось включить фокус.",
          });
          return;
        }

        setState((current) => ({
          ...current,
          spotlightUntil: payload.expiresAt || current.spotlightUntil,
        }));
        notify({
          variant: "success",
          title: "Фокус активирован",
        });
        startRefreshTransition(() => {
          router.refresh();
        });
        return;
      }

      const response = await fetch("/api/aura-actions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, variant }),
      });

      const payload = (await response.json().catch(() => ({}))) as {
        error?: string;
        expiresAt?: string | null;
        cooldownUntil?: string | null;
        streak?: number;
        variant?: string | null;
      };

      if (!response.ok) {
        notify({
          variant: "error",
          title: "Трата не выполнена",
          message: payload.error || "Не удалось выполнить трату.",
        });
        return;
      }

      if (action === "decay_shield") {
        setState((current) => ({
          ...current,
          decayShieldUntil: payload.expiresAt || current.decayShieldUntil,
        }));
        notify({
          variant: "success",
          title: "Щит активирован",
        });
      } else if (action === "streak_save") {
        setState((current) => ({
          ...current,
          streak: Number(payload.streak || current.streak),
          canRescueStreak: false,
          rescueAvailableAt: payload.cooldownUntil || current.rescueAvailableAt,
        }));
        notify({
          variant: "success",
          title: "Серия сохранена",
        });
      } else {
        setState((current) => ({
          ...current,
          cardAccent: payload.variant || variant || current.cardAccent,
          cardAccentUntil: payload.expiresAt || current.cardAccentUntil,
        }));
        notify({
          variant: "success",
          title: "Акцент активирован",
        });
      }

      startRefreshTransition(() => {
        router.refresh();
      });
    } catch {
      notify({
        variant: "error",
        title: "Сетевая ошибка",
        message: "Не удалось выполнить трату. Попробуй снова.",
      });
    } finally {
      setPendingAction(null);
    }
  };

  return (
    <section className="w-full max-w-xl rounded-3xl border border-white/10 bg-black/30 backdrop-blur-md p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-[10px] font-black uppercase tracking-[0.2em] text-white/70">Траты ауры</h2>
          <p className="mt-1 text-[11px] text-white/45">Осмысленные действия с лимитами и сроком действия.</p>
        </div>
        <button
          type="button"
          onClick={() => setIsPreviewOpen(true)}
          className="rounded-xl border border-white/15 bg-white/[0.03] px-3 py-2 text-[10px] font-black uppercase tracking-[0.1em] text-white/75 transition-colors hover:border-white/25"
        >
          Посмотреть эффекты
        </button>
      </div>

      <div className="mt-4 space-y-3">
        <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-3">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.12em] text-white/80">Щит от угасания (24ч)</p>
              <p className="text-[10px] text-white/50">
                {shieldActive
                  ? `Активен до ${formatDate(state.decayShieldUntil)} (UTC+0)`
                  : "Блокирует ежедневное угасание на ограниченное время."}
              </p>
            </div>
            <button
              type="button"
              onClick={() => runAction("decay_shield")}
              disabled={actionLocked || shieldActive}
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
                {state.canRescueStreak
                  ? `Доступно сейчас. Текущая серия: ${state.streak} дн.`
                  : state.rescueAvailableAt
                    ? `Перезарядка до ${formatDate(state.rescueAvailableAt)} (UTC+0)`
                    : "Доступно только при 1 пропущенном дне и активной серии."}
              </p>
            </div>
            <button
              type="button"
              onClick={() => runAction("streak_save")}
              disabled={actionLocked || !state.canRescueStreak}
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
                  ? `Активен до ${formatDate(state.spotlightUntil)} (UTC+0)`
                  : "Временная видимость профиля в отдельном блоке лидерборда."}
              </p>
            </div>
            <button
              type="button"
              onClick={() => runAction("spotlight")}
              disabled={actionLocked || spotlightActive}
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
              ? `Активен: ${ACCENT_LABELS[state.cardAccent || ""] || state.cardAccent} до ${formatDate(state.cardAccentUntil)} (UTC+0)`
              : "Один контролируемый визуальный эффект без хаоса в стиле."}
          </p>
          <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-3">
            {CARD_ACCENT_VARIANTS.map((variant) => (
              <button
                key={variant}
                type="button"
                onClick={() => runAction("card_accent", variant)}
                disabled={actionLocked || accentActive}
                className="rounded-xl border border-white/15 bg-white/[0.02] px-2 py-2 text-[10px] font-black uppercase tracking-[0.08em] text-white/80 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {pendingAction === "card_accent" ? "..." : `${ACCENT_LABELS[variant]} • -${CARD_ACCENT_COST}`}
              </button>
            ))}
          </div>
        </div>
      </div>

      {isRefreshing && <p className="mt-3 text-[10px] uppercase tracking-[0.08em] text-white/45">Обновляем профиль…</p>}

      {isPreviewOpen ? (
        <div className="fixed inset-0 z-[220] bg-black/85 backdrop-blur-sm p-4 flex items-center justify-center" role="dialog" aria-modal="true">
          <div className="w-full max-w-xl rounded-3xl border border-white/15 bg-black/90 p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.12em] text-white/75">Предпросмотр эффектов</p>
                <p className="mt-1 text-[11px] leading-relaxed text-white/55">
                  Эффекты применяются только на ограниченное время. Здесь можно быстро оценить стиль перед покупкой.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsPreviewOpen(false)}
                className="rounded-xl border border-white/20 px-3 py-2 text-[10px] font-black uppercase tracking-[0.1em] text-white/75 hover:border-white/35"
              >
                Закрыть
              </button>
            </div>

            <div className="mt-4 rounded-xl border border-neon-pink/30 bg-neon-pink/5 p-3">
              <p className="text-[10px] font-black uppercase tracking-[0.08em] text-neon-pink">Фокус</p>
              <p className="mt-1 text-[10px] text-white/55">Профиль попадает во вкладку «В фокусе» и выделяется меткой времени.</p>
            </div>

            <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-3">
              {CARD_ACCENT_VARIANTS.map((variant) => (
                <div key={`preview-${variant}`} className="rounded-xl border border-white/10 bg-black/30 p-2">
                  <p className="text-[9px] uppercase tracking-[0.08em] text-white/60">Акцент</p>
                  <div className={`mt-2 h-10 rounded-lg border ${getAccentPreviewClass(variant)} bg-white/[0.03]`} />
                  <p className="mt-2 text-[10px] font-black uppercase tracking-[0.08em] text-white/80">{ACCENT_LABELS[variant]}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
