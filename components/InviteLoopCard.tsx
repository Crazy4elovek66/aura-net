"use client";

import { useEffect, useRef, useState } from "react";
import {
  REFERRAL_ACTIVITY_DAILY_CAP,
  REFERRAL_ACTIVITY_DURATION_DAYS,
  REFERRAL_ACTIVITY_PERCENT,
} from "@/lib/economy";

interface ReferralEntry {
  id: string;
  inviteeId: string;
  inviteeUsername: string | null;
  inviteeDisplayName: string;
  status: "pending" | "activated" | "rejected";
  joinedAt: string;
  activatedAt: string | null;
  inviterReward: number;
  inviteeReward: number;
  hasFirstClaim: boolean;
}

interface InviteLoopCardProps {
  inviteCode: string | null;
  webInviteLink: string | null;
  telegramInviteLink: string | null;
  referrals: ReferralEntry[];
}

async function copyText(value: string) {
  if (!navigator.clipboard?.writeText) {
    throw new Error("clipboard_unavailable");
  }

  await navigator.clipboard.writeText(value);
}

function formatDate(iso: string | null) {
  if (!iso) return "-";

  return new Date(iso).toLocaleString("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function getReferralStage(referral: ReferralEntry) {
  if (referral.status === "activated") {
    return {
      key: "activated",
      label: "Активация завершена",
      detail: `Петля закрыта. Ты получил +${referral.inviterReward}, друг получил +${referral.inviteeReward}.`,
      accent: "border-neon-green/35 bg-neon-green/10 text-neon-green",
    };
  }

  if (referral.hasFirstClaim) {
    return {
      key: "waiting_activity",
      label: "Ждём активность",
      detail: "Первый вход уже есть. Нужен живой социальный сигнал (голос), чтобы закрыть активацию.",
      accent: "border-neon-pink/35 bg-neon-pink/10 text-neon-pink",
    };
  }

  return {
    key: "waiting_first_entry",
    label: "Ждём первый вход",
    detail: "Друг уже привязался. Следующий шаг: первый ежедневный вход, чтобы петля сдвинулась дальше.",
    accent: "border-neon-purple/35 bg-neon-purple/10 text-neon-purple",
  };
}

export default function InviteLoopCard({
  inviteCode,
  webInviteLink,
  telegramInviteLink,
  referrals,
}: InviteLoopCardProps) {
  const [copied, setCopied] = useState<string | null>(null);
  const [sentState, setSentState] = useState<string | null>(null);
  const resetTimerRef = useRef<number | null>(null);
  const [copyError, setCopyError] = useState<string | null>(null);

  const pendingCount = referrals.filter((entry) => entry.status === "pending").length;
  const activatedCount = referrals.filter((entry) => entry.status === "activated").length;
  const waitingFirstClaimCount = referrals.filter((entry) => entry.status !== "activated" && !entry.hasFirstClaim).length;
  const waitingSocialProofCount = referrals.filter((entry) => entry.status !== "activated" && entry.hasFirstClaim).length;

  useEffect(() => {
    return () => {
      if (resetTimerRef.current !== null) {
        window.clearTimeout(resetTimerRef.current);
      }
    };
  }, []);

  const armReset = (key: string | null) => {
    if (resetTimerRef.current !== null) {
      window.clearTimeout(resetTimerRef.current);
    }

    resetTimerRef.current = window.setTimeout(() => {
      setCopied((current) => (current === key ? null : current));
      setSentState((current) => (current === key ? null : current));
    }, 1800);
  };

  const copyLink = async (key: string, value: string | null) => {
    if (!value) return;

    try {
      await copyText(value);
      setCopied(key);
      setSentState(key);
      setCopyError(null);
      armReset(key);
    } catch (error) {
      console.error("[InviteLoopCard] Failed to copy invite link", error);
      setCopied(null);
      setSentState(null);
      setCopyError("Не удалось открыть буфер обмена. Скопируй ссылку вручную.");
    }
  };

  return (
    <section
      id="invite-loop-card"
      className="w-full max-w-xl rounded-3xl border border-white/10 bg-black/30 p-5 backdrop-blur-md"
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-[10px] font-black uppercase tracking-[0.2em] text-white/70">Инвайт-петля</h2>
          <p className="mt-2 text-[11px] leading-relaxed text-white/55">
            Видно не только сколько друзей пришло, но и на каком шаге они остановились.
            После активации включается мягкий процент с их социальной активности.
          </p>
        </div>
        <div className="rounded-2xl border border-neon-green/20 bg-neon-green/[0.06] px-3 py-2 text-right">
          <p className="text-[9px] uppercase tracking-[0.1em] text-white/45">Закрыто петель</p>
          <p className="text-sm font-black text-neon-green">{activatedCount}</p>
        </div>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-3">
          <p className="text-[10px] uppercase tracking-[0.1em] text-white/45">Инвайт-код</p>
          <p className="mt-2 text-sm font-black text-white">{inviteCode || "Скоро появится"}</p>
          <p className="mt-1 text-[10px] uppercase tracking-[0.08em] text-white/40">После активации: +25 тебе и +10 другу</p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-3">
          <p className="text-[10px] uppercase tracking-[0.1em] text-white/45">Процент после активации</p>
          <p className="mt-2 text-[11px] leading-relaxed text-white/65">
            Ты получаешь {REFERRAL_ACTIVITY_PERCENT}% с плюс-голосов приглашённого.
            Лимит: до +{REFERRAL_ACTIVITY_DAILY_CAP} в сутки с одного приглашённого,
            окно выплат: {REFERRAL_ACTIVITY_DURATION_DAYS} дней.
          </p>
        </div>
      </div>

      <div className="mt-3 grid gap-2 sm:grid-cols-4">
        <div className="rounded-2xl border border-white/10 bg-black/20 p-3">
          <p className="text-[9px] uppercase tracking-[0.1em] text-white/45">Привязались</p>
          <p className="mt-2 text-lg font-black text-white">{pendingCount + activatedCount}</p>
        </div>
        <div className="rounded-2xl border border-neon-purple/20 bg-black/20 p-3">
          <p className="text-[9px] uppercase tracking-[0.1em] text-white/45">Ждём вход</p>
          <p className="mt-2 text-lg font-black text-neon-purple">{waitingFirstClaimCount}</p>
        </div>
        <div className="rounded-2xl border border-neon-pink/20 bg-black/20 p-3">
          <p className="text-[9px] uppercase tracking-[0.1em] text-white/45">Ждём активность</p>
          <p className="mt-2 text-lg font-black text-neon-pink">{waitingSocialProofCount}</p>
        </div>
        <div className="rounded-2xl border border-neon-green/20 bg-black/20 p-3">
          <p className="text-[9px] uppercase tracking-[0.1em] text-white/45">Активированы</p>
          <p className="mt-2 text-lg font-black text-neon-green">{activatedCount}</p>
        </div>
      </div>

      <div className="mt-4 space-y-2">
        <button
          type="button"
          onClick={() => copyLink("web", webInviteLink)}
          disabled={!webInviteLink}
          className="flex w-full items-center justify-between rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-left text-[11px] text-white/75 transition-all hover:border-white/20 disabled:opacity-50"
        >
          <span className="truncate pr-3">{webInviteLink || "Веб-ссылка пока недоступна"}</span>
          <span className="text-[10px] font-black uppercase tracking-[0.1em] text-neon-purple">
            {copied === "web" ? "Скопировано" : "Копировать"}
          </span>
        </button>

        {telegramInviteLink ? (
          <button
            type="button"
            onClick={() => copyLink("telegram", telegramInviteLink)}
            className="flex w-full items-center justify-between rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-left text-[11px] text-white/75 transition-all hover:border-white/20"
          >
            <span className="truncate pr-3">{telegramInviteLink}</span>
            <span className="text-[10px] font-black uppercase tracking-[0.1em] text-neon-green">
              {copied === "telegram" ? "Скопировано" : "Копировать"}
            </span>
          </button>
        ) : null}

        {sentState ? (
          <p className="rounded-2xl border border-neon-green/20 bg-neon-green/[0.06] px-3 py-2 text-[10px] uppercase tracking-[0.08em] text-neon-green/90">
            Ссылка готова к отправке. Как только друг привяжется, он появится в списке ниже.
          </p>
        ) : null}

        {copyError ? (
          <p className="rounded-2xl border border-neon-pink/20 bg-neon-pink/[0.06] px-3 py-2 text-[10px] uppercase tracking-[0.08em] text-neon-pink/90">
            {copyError}
          </p>
        ) : null}
      </div>

      <div className="mt-4 space-y-2">
        {referrals.length ? (
          referrals.map((referral) => {
            const stage = getReferralStage(referral);

            return (
              <div key={referral.id} className="rounded-2xl border border-white/10 bg-white/[0.02] px-3 py-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-[11px] font-black text-white/90">{referral.inviteeDisplayName}</p>
                    <p className="mt-1 text-[10px] uppercase tracking-[0.08em] text-white/45">
                      Привязался: {formatDate(referral.joinedAt)} UTC+0
                    </p>
                  </div>
                  <span className={`rounded-full border px-2.5 py-1 text-[9px] font-black uppercase tracking-[0.1em] ${stage.accent}`}>
                    {stage.label}
                  </span>
                </div>
                <p className="mt-2 text-[11px] leading-relaxed text-white/65">{stage.detail}</p>
                {referral.activatedAt ? (
                  <p className="mt-2 text-[10px] uppercase tracking-[0.08em] text-white/45">
                    Активирован: {formatDate(referral.activatedAt)} UTC+0
                  </p>
                ) : null}
              </div>
            );
          })
        ) : (
          <p className="rounded-2xl border border-white/10 bg-white/[0.02] px-3 py-3 text-[11px] leading-relaxed text-white/55">
            Пока никто не вошёл в петлю. Рабочий старт обычно такой: отправляешь карточку с контекстом, затем сразу даёшь ссылку на вход.
          </p>
        )}
      </div>
    </section>
  );
}

