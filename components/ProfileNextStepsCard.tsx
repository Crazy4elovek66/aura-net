import Link from "next/link";

interface ProfileNextStepsCardProps {
  auraPoints: number;
  dailyStreak: number;
  claimedToday: boolean;
  activatedInvites: number;
  pendingInvites: number;
  votesCast: number;
  profileShareLink: string;
  inviteLink: string | null;
}

interface StepItem {
  id: string;
  eyebrow: string;
  title: string;
  description: string;
  href: string;
  action: string;
}

const TIER_TARGETS = [
  { threshold: 501, label: "ГЕРОЙ" },
  { threshold: 2001, label: "ТОТ САМЫЙ" },
  { threshold: 5001, label: "СИГМА" },
];

function getNextTierTarget(auraPoints: number) {
  return TIER_TARGETS.find((tier) => auraPoints < tier.threshold) ?? null;
}

export default function ProfileNextStepsCard({
  auraPoints,
  dailyStreak,
  claimedToday,
  activatedInvites,
  pendingInvites,
  votesCast,
  profileShareLink,
  inviteLink,
}: ProfileNextStepsCardProps) {
  const nextTier = getNextTierTarget(auraPoints);
  const steps: StepItem[] = [];

  if (!claimedToday) {
    steps.push({
      id: "daily",
      eyebrow: "Серия",
      title: dailyStreak > 0 ? "Забери награду дня и не роняй темп" : "Запусти первую серию входов",
      description:
        dailyStreak > 0
          ? `Следующий вход продлит серию и приблизит ближайший рубеж. Сейчас у тебя ${dailyStreak} дн. подряд.`
          : "Первый ежедневный вход сразу запускает ритм: серия, недельный прогресс и новые поводы для публикаций.",
      href: "/profile?tab=profile#daily-reward-card",
      action: "Забрать награду",
    });
  }

  if (votesCast <= 0) {
    steps.push({
      id: "discover",
      eyebrow: "Живой сигнал",
      title: "Сделай первый ход в разведке",
      description:
        "Один реальный голос быстрее всего превращает профиль из пустого слота в живую карточку и запускает доверие внутри продукта.",
      href: "/discover",
      action: "Открыть разведку",
    });
  }

  if (activatedInvites <= 0) {
    steps.push({
      id: "invite",
      eyebrow: "Инвайт-петля",
      title: pendingInvites > 0 ? "Дожми один инвайт до активации" : "Отправь первый инвайт",
      description:
        pendingInvites > 0
          ? "Друг уже вошёл в петлю. Теперь ему нужен первый ежедневный вход, а после него любое живое действие."
          : "Личный инвайт запускает возвратный цикл: зовёшь человека, видишь его прогресс и возвращаешься проверить активацию.",
      href: "/profile?tab=circle#invite-loop-card",
      action: pendingInvites > 0 ? "Открыть петлю" : "Позвать друга",
    });
  }

  if (nextTier) {
    steps.push({
      id: "tier",
      eyebrow: "Следующий уровень",
      title: `Ещё ${nextTier.threshold - auraPoints} до ${nextTier.label}`,
      description:
        "Чем яснее ближайший порог, тем легче чувствовать рост. Здесь важен не абстрактный гринд, а короткая достижимая цель.",
      href: "/profile?tab=progress#profile-race-card",
      action: "Смотреть прогресс",
    });
  }

  if (steps.length < 3) {
    steps.push({
      id: "share",
      eyebrow: "Публикация",
      title: "Держи карточку и ссылку под рукой",
      description: inviteLink
        ? "Карточка даёт понятный повод рассказать о себе, а инвайт закрывает следующий шаг для нового человека."
        : `Публичная ссылка уже готова: ${profileShareLink}`,
      href: "/profile?tab=circle#shareable-moments-card",
      action: "Открыть поводы",
    });
  }

  const primaryStep = steps[0] ?? null;
  const secondarySteps = steps.slice(1, 3);

  return (
    <section className="w-full max-w-xl rounded-3xl border border-neon-green/25 bg-neon-green/[0.07] p-5 backdrop-blur-md">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-[10px] font-black uppercase tracking-[0.2em] text-neon-green/90">Следующий ход</h2>
          <p className="mt-2 text-[11px] leading-relaxed text-white/70">
            Короткая подсказка без длинного туториала: сначала главный шаг, затем дополнительные ходы по запросу.
          </p>
        </div>
        <div className="rounded-2xl border border-neon-green/25 bg-black/20 px-3 py-2 text-right">
          <p className="text-[9px] uppercase tracking-[0.1em] text-white/45">Фокус</p>
          <p className="text-sm font-black text-neon-green">{Math.min(steps.length, 3)} шага</p>
        </div>
      </div>

      {primaryStep ? (
        <div className="mt-4 rounded-2xl border border-white/10 bg-black/20 p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[9px] font-black uppercase tracking-[0.14em] text-neon-green/80">1. {primaryStep.eyebrow}</p>
              <p className="mt-2 text-sm font-black text-white">{primaryStep.title}</p>
              <p className="mt-2 text-[11px] leading-relaxed text-white/62">{primaryStep.description}</p>
            </div>
            <Link
              href={primaryStep.href}
              className="shrink-0 rounded-xl border border-neon-green/35 bg-neon-green/10 px-3 py-2 text-[10px] font-black uppercase tracking-[0.12em] text-neon-green transition-colors hover:bg-neon-green/15"
            >
              {primaryStep.action}
            </Link>
          </div>
        </div>
      ) : null}

      {secondarySteps.length ? (
        <details className="group mt-3 rounded-2xl border border-white/10 bg-black/20">
          <summary className="list-none cursor-pointer px-4 py-3">
            <p className="text-[10px] font-black uppercase tracking-[0.12em] text-white/70">
              Ещё {secondarySteps.length} подсказки
            </p>
          </summary>
          <div className="space-y-2 px-3 pb-3">
            {secondarySteps.map((step, index) => (
              <div key={step.id} className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-[9px] font-black uppercase tracking-[0.12em] text-neon-green/80">
                      {index + 2}. {step.eyebrow}
                    </p>
                    <p className="mt-1 text-[12px] font-black text-white">{step.title}</p>
                  </div>
                  <Link
                    href={step.href}
                    className="shrink-0 rounded-lg border border-neon-green/30 bg-neon-green/10 px-2.5 py-1.5 text-[9px] font-black uppercase tracking-[0.1em] text-neon-green transition-colors hover:bg-neon-green/15"
                  >
                    {step.action}
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </details>
      ) : null}
    </section>
  );
}
