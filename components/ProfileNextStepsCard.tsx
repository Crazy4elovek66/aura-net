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
      title: dailyStreak > 0 ? "Забери claim и не роняй темп" : "Запусти первую серию",
      description:
        dailyStreak > 0
          ? `Следующий вход продлит серию и приблизит ближайший milestone. Сейчас у тебя ${dailyStreak} дн. подряд.`
          : "Первый daily claim сразу даёт понятный ритм: серия, weekly progress и новые поводы для момента.",
      href: "#daily-reward-card",
      action: "Забрать daily",
    });
  }

  if (votesCast <= 0) {
    steps.push({
      id: "discover",
      eyebrow: "Живой сигнал",
      title: "Сделай первый ход в разведке",
      description:
        "Один реальный vote быстрее всего превращает профиль из пустого слота в живую карточку и запускает social proof внутри продукта.",
      href: "/discover",
      action: "Открыть разведку",
    });
  }

  if (activatedInvites <= 0) {
    steps.push({
      id: "invite",
      eyebrow: "Инвайт-луп",
      title: pendingInvites > 0 ? "Дожми один инвайт до активации" : "Отправь первый инвайт",
      description:
        pendingInvites > 0
          ? "Друг уже вошёл в петлю. Теперь ему нужен first claim, а после него любой живой social signal."
          : "Личный инвайт создаёт возвратный цикл: ты зовёшь человека, видишь его прогресс и возвращаешься проверить активацию.",
      href: "#invite-loop-card",
      action: pendingInvites > 0 ? "Открыть петлю" : "Позвать друга",
    });
  }

  if (nextTier) {
    steps.push({
      id: "tier",
      eyebrow: "Следующий tier",
      title: `Ещё ${nextTier.threshold - auraPoints} до ${nextTier.label}`,
      description:
        "Чем яснее ближайший порог, тем легче почувствовать рост. Здесь важен не абстрактный grind, а короткая достижимая цель.",
      href: "#profile-race-card",
      action: "Смотреть прогресс",
    });
  }

  if (steps.length < 3) {
    steps.push({
      id: "share",
      eyebrow: "Шаринг",
      title: "Держи ссылку и карточку под рукой",
      description: inviteLink
        ? "Карточка даёт публичный повод, а инвайт закрывает следующий шаг. Вместе они работают лучше, чем по отдельности."
        : `Публичная ссылка уже готова: ${profileShareLink}`,
      href: "#shareable-moments-card",
      action: "Открыть поводы",
    });
  }

  return (
    <section className="w-full max-w-xl rounded-3xl border border-neon-green/25 bg-neon-green/[0.07] p-5 backdrop-blur-md">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-[10px] font-black uppercase tracking-[0.2em] text-neon-green/90">Следующий ход</h2>
          <p className="mt-2 text-[11px] leading-relaxed text-white/70">
            Без длинного туториала: вот самые полезные ходы, которые быстрее всего усиливают карточку, прогресс и возврат.
          </p>
        </div>
        <div className="rounded-2xl border border-neon-green/25 bg-black/20 px-3 py-2 text-right">
          <p className="text-[9px] uppercase tracking-[0.1em] text-white/45">Фокус</p>
          <p className="text-sm font-black text-neon-green">{Math.min(steps.length, 3)} шага</p>
        </div>
      </div>

      <div className="mt-4 space-y-3">
        {steps.slice(0, 3).map((step, index) => (
          <div key={step.id} className="rounded-2xl border border-white/10 bg-black/20 p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[9px] font-black uppercase tracking-[0.14em] text-neon-green/80">
                  {index + 1}. {step.eyebrow}
                </p>
                <p className="mt-2 text-sm font-black text-white">{step.title}</p>
                <p className="mt-2 text-[11px] leading-relaxed text-white/62">{step.description}</p>
              </div>
              <Link
                href={step.href}
                className="shrink-0 rounded-xl border border-neon-green/35 bg-neon-green/10 px-3 py-2 text-[10px] font-black uppercase tracking-[0.12em] text-neon-green transition-colors hover:bg-neon-green/15"
              >
                {step.action}
              </Link>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
