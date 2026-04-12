"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

interface ShareableMoment {
  id: string;
  moment_type: string;
  payload?: Record<string, unknown> | null;
  created_at: string;
}

interface ShareableMomentsCardProps {
  moments: ShareableMoment[];
  username: string;
  displayName: string;
  profileShareLink: string;
  inviteLink: string | null;
}

const MOMENT_LABELS: Record<string, string> = {
  achievement_unlocked: "Достижение",
  tier_reached: "Новый уровень",
  weekly_title_awarded: "Титул недели",
  streak_milestone: "Рубеж серии",
  leaderboard_top10_entered: "Вход в топ-10",
  referral_activated: "Активированный инвайт",
};

function asNumber(value: unknown) {
  return typeof value === "number" ? value : Number(value || 0);
}

function getMomentHeadline(moment: ShareableMoment) {
  const payload = moment.payload || {};

  if (moment.moment_type === "achievement_unlocked") {
    return typeof payload.achievementTitle === "string" ? payload.achievementTitle : "Открыто новое достижение";
  }

  if (moment.moment_type === "tier_reached") {
    return typeof payload.tierLabel === "string" ? `Вышел в ${payload.tierLabel}` : "Поднялся на новый уровень";
  }

  if (moment.moment_type === "weekly_title_awarded") {
    return typeof payload.title === "string" ? payload.title : "Получен новый недельный титул";
  }

  if (moment.moment_type === "streak_milestone") {
    return typeof payload.milestoneDays === "number" ? `${payload.milestoneDays} дней подряд` : "Взят новый рубеж серии";
  }

  if (moment.moment_type === "leaderboard_top10_entered") {
    return typeof payload.rank === "number" ? `Залетел в топ-${payload.rank}` : "Вошел в топ-10";
  }

  if (moment.moment_type === "referral_activated") {
    return typeof payload.inviterReward === "number"
      ? `Инвайт сработал: +${payload.inviterReward} ауры`
      : "Инвайт полностью активирован";
  }

  return "Есть повод показать карточку";
}

function getMomentReason(moment: ShareableMoment) {
  const payload = moment.payload || {};

  if (moment.moment_type === "achievement_unlocked") {
    return "Достижения проще объясняют рост, чем просто цифра в профиле.";
  }

  if (moment.moment_type === "tier_reached") {
    return "Новый уровень заметно меняет статус карточки и цепляет внимание.";
  }

  if (moment.moment_type === "weekly_title_awarded") {
    return "Титул живет недолго, поэтому им лучше делиться сразу.";
  }

  if (moment.moment_type === "streak_milestone") {
    return `Серия ${asNumber(payload.milestoneDays)} дней выглядит как дисциплина, а не случайность.`;
  }

  if (moment.moment_type === "leaderboard_top10_entered") {
    return "Вход в топ-10 дает сильный социальный повод вернуть людей в профиль.";
  }

  if (moment.moment_type === "referral_activated") {
    return "Это сигнал, что твой круг реально растет и механика приглашений работает.";
  }

  return "Публичный повод, который можно быстро отправить в чат или сторис.";
}

function buildShareText(
  moment: ShareableMoment,
  displayName: string,
  username: string,
  profileShareLink: string,
  inviteLink: string | null,
) {
  const payload = moment.payload || {};
  let opener = `${displayName} (@${username}) обновил карточку в Aura.net.`;

  if (moment.moment_type === "achievement_unlocked") {
    opener = `Открыл достижение «${typeof payload.achievementTitle === "string" ? payload.achievementTitle : "новый апдейт"}» в Aura.net.`;
  } else if (moment.moment_type === "tier_reached") {
    opener = `Поднялся до уровня «${typeof payload.tierLabel === "string" ? payload.tierLabel : "новый уровень"}».`;
  } else if (moment.moment_type === "weekly_title_awarded") {
    opener = `Получил недельный титул «${typeof payload.title === "string" ? payload.title : "новый титул"}».`;
  } else if (moment.moment_type === "streak_milestone") {
    opener = `Держу серию уже ${asNumber(payload.milestoneDays)} дней подряд.`;
  } else if (moment.moment_type === "leaderboard_top10_entered") {
    opener = `Залетел в топ-10 Aura.net${asNumber(payload.rank) > 0 ? ` на #${asNumber(payload.rank)}` : ""}.`;
  } else if (moment.moment_type === "referral_activated") {
    opener = `Инвайт в Aura.net сработал: новый человек активирован, карточка получила +${asNumber(payload.inviterReward)} ауры.`;
  }

  return [
    opener,
    `Моя карточка: ${profileShareLink}`,
    inviteLink ? `Хочешь зайти сразу по инвайту: ${inviteLink}` : null,
  ]
    .filter(Boolean)
    .join("\n");
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleString("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function ShareableMomentsCard({
  moments,
  username,
  displayName,
  profileShareLink,
  inviteLink,
}: ShareableMomentsCardProps) {
  const [copiedMomentId, setCopiedMomentId] = useState<string | null>(null);
  const [copyError, setCopyError] = useState<string | null>(null);
  const resetTimerRef = useRef<number | null>(null);
  const featuredMoment = moments[0] ?? null;

  useEffect(() => {
    return () => {
      if (resetTimerRef.current !== null) {
        window.clearTimeout(resetTimerRef.current);
      }
    };
  }, []);

  const handleCopy = async (moment: ShareableMoment) => {
    try {
      if (!navigator.clipboard?.writeText) {
        throw new Error("clipboard_unavailable");
      }

      const text = buildShareText(moment, displayName, username, profileShareLink, inviteLink);
      await navigator.clipboard.writeText(text);
      setCopyError(null);
      setCopiedMomentId(moment.id);
      if (resetTimerRef.current !== null) {
        window.clearTimeout(resetTimerRef.current);
      }
      resetTimerRef.current = window.setTimeout(() => {
        setCopiedMomentId((current) => (current === moment.id ? null : current));
      }, 1800);
    } catch (error) {
      console.error("[ShareableMomentsCard] Failed to copy share text", error);
      setCopiedMomentId(null);
      setCopyError("Не получилось скопировать автоматически. Скопируй текст вручную.");
    }
  };

  return (
    <section
      id="shareable-moments-card"
      className="w-full max-w-xl rounded-3xl border border-white/10 bg-black/30 p-5 backdrop-blur-md"
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-[10px] font-black uppercase tracking-[0.2em] text-white/70">Поводы поделиться</h2>
          <p className="mt-2 text-[11px] leading-relaxed text-white/55">
            Готовые поводы, чтобы быстро рассказать о росте, вернуть внимание к карточке и при желании добавить инвайт.
          </p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-3 py-2 text-right">
          <p className="text-[9px] uppercase tracking-[0.1em] text-white/45">Готово к отправке</p>
          <p className="text-sm font-black text-white">{moments.length}</p>
        </div>
      </div>

      <div className="mt-3 grid gap-2 sm:grid-cols-3">
        <div className="rounded-xl border border-white/10 bg-black/20 p-2.5 text-[10px] text-white/65">Показываешь конкретный апдейт</div>
        <div className="rounded-xl border border-white/10 bg-black/20 p-2.5 text-[10px] text-white/65">Возвращаешь людей к профилю</div>
        <div className="rounded-xl border border-white/10 bg-black/20 p-2.5 text-[10px] text-white/65">Усиливаешь инвайты и круг</div>
      </div>

      {featuredMoment ? (
        <div className="mt-4 rounded-[1.5rem] border border-neon-purple/25 bg-neon-purple/[0.08] p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[9px] font-black uppercase tracking-[0.14em] text-neon-purple/90">Рекомендованный повод</p>
              <p className="mt-2 text-sm font-black text-white">
                {MOMENT_LABELS[featuredMoment.moment_type] || featuredMoment.moment_type}
              </p>
              <p className="mt-1 text-lg font-black text-white">{getMomentHeadline(featuredMoment)}</p>
            </div>
            <p className="text-[9px] uppercase tracking-[0.08em] text-white/45">{formatDate(featuredMoment.created_at)}</p>
          </div>

          <p className="mt-3 text-[11px] leading-relaxed text-white/70">{getMomentReason(featuredMoment)}</p>

          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => handleCopy(featuredMoment)}
              className="rounded-xl border border-neon-purple/35 bg-neon-purple/10 px-3 py-2 text-[10px] font-black uppercase tracking-[0.12em] text-neon-purple transition-colors hover:bg-neon-purple/15"
            >
              {copiedMomentId === featuredMoment.id ? "Текст скопирован" : "Скопировать текст"}
            </button>
            <Link
              href={profileShareLink}
              className="rounded-xl border border-white/15 bg-black/20 px-3 py-2 text-[10px] font-black uppercase tracking-[0.12em] text-white/75 transition-colors hover:border-white/25"
            >
              Открыть карточку
            </Link>
            {inviteLink ? (
              <a
                href={inviteLink}
                className="rounded-xl border border-neon-green/30 bg-neon-green/10 px-3 py-2 text-[10px] font-black uppercase tracking-[0.12em] text-neon-green transition-colors hover:bg-neon-green/15"
              >
                Добавить инвайт
              </a>
            ) : null}
          </div>
        </div>
      ) : (
        <p className="mt-4 rounded-2xl border border-white/10 bg-white/[0.02] px-4 py-3 text-[11px] leading-relaxed text-white/58">
          Пока нет свежих поводов. Они появятся после достижений, титулов недели, рубежей серии, входа в топ-10 и
          активаций инвайтов.
        </p>
      )}

      {copyError ? (
        <p className="mt-3 rounded-2xl border border-neon-pink/20 bg-neon-pink/[0.06] px-3 py-2 text-[10px] uppercase tracking-[0.08em] text-neon-pink/90">
          {copyError}
        </p>
      ) : null}

      {moments.length > 1 ? (
        <details className="group mt-3 rounded-2xl border border-white/10 bg-white/[0.02]">
          <summary className="list-none cursor-pointer px-4 py-3">
            <p className="text-[10px] font-black uppercase tracking-[0.12em] text-white/70">Еще поводы ({moments.length - 1})</p>
          </summary>
          <div className="space-y-2 px-3 pb-3">
            {moments.slice(1).map((moment) => (
              <div key={moment.id} className="rounded-2xl border border-white/10 bg-white/[0.02] px-3 py-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-[0.12em] text-white/55">
                      {MOMENT_LABELS[moment.moment_type] || moment.moment_type}
                    </p>
                    <p className="mt-1 text-sm text-white/90">{getMomentHeadline(moment)}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleCopy(moment)}
                    className="shrink-0 rounded-xl border border-white/15 bg-black/20 px-3 py-2 text-[10px] font-black uppercase tracking-[0.1em] text-white/70 transition-colors hover:border-white/25"
                  >
                    {copiedMomentId === moment.id ? "Скопировано" : "Копировать"}
                  </button>
                </div>
                <p className="mt-2 text-[10px] uppercase tracking-[0.08em] text-white/45">{formatDate(moment.created_at)} UTC+0</p>
              </div>
            ))}
          </div>
        </details>
      ) : null}
    </section>
  );
}
