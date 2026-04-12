import Link from "next/link";

interface BaseLeader {
  id: string;
  username: string;
  displayName: string;
  auraPoints: number;
}

interface RaceContext {
  profileId: string;
  rank: number;
  distanceToNext: number;
  distanceToTop10: number;
  above: BaseLeader | null;
  below: BaseLeader | null;
}

interface WeeklyTitle {
  key: string;
  title: string;
}

interface ProfileRaceCardProps {
  raceContext: RaceContext | null;
  weeklyTitles: WeeklyTitle[];
  auraPoints: number;
  dailyStreak: number;
}

const STREAK_MILESTONES = [3, 7, 14, 30];
const TIER_TARGETS = [
  { threshold: 501, label: "ГЕРОЙ" },
  { threshold: 2001, label: "ТОТ САМЫЙ" },
  { threshold: 5001, label: "СИГМА" },
];

function getNextTierTarget(auraPoints: number) {
  return TIER_TARGETS.find((tier) => auraPoints < tier.threshold) ?? null;
}

function getNextStreakTarget(streak: number) {
  return STREAK_MILESTONES.find((milestone) => milestone > streak) ?? null;
}

function getDistanceTone(distance: number) {
  if (distance <= 0) return "уже закрыто";
  if (distance <= 15) return "один хороший импульс";
  if (distance <= 50) return "совсем рядом";
  if (distance <= 150) return "рабочая цель";
  return "длиннее, но реально";
}

export default function ProfileRaceCard({ raceContext, weeklyTitles, auraPoints, dailyStreak }: ProfileRaceCardProps) {
  const nextTier = getNextTierTarget(auraPoints);
  const nextStreak = getNextStreakTarget(dailyStreak);

  if (!raceContext) {
    return (
      <section
        id="profile-race-card"
        className="w-full max-w-xl rounded-3xl border border-white/10 bg-black/30 backdrop-blur-md p-5"
      >
        <p className="text-[11px] text-white/55">Персональная гонка появится после входа в аккаунт.</p>
      </section>
    );
  }

  const my = raceContext;
  const rankTone =
    my.distanceToTop10 <= 0
      ? "Ты уже держишься в заметной зоне."
      : my.distanceToTop10 <= 25
        ? "До топ-10 буквально один плотный заход."
        : `До топ-10 ещё ${my.distanceToTop10}, но цель уже читается.`;

  return (
    <section
      id="profile-race-card"
      className="w-full max-w-xl rounded-3xl border border-neon-purple/30 bg-neon-purple/10 backdrop-blur-md p-5"
    >
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-[10px] font-black uppercase tracking-[0.18em] text-white/75">Локальная гонка</h2>
          <p className="mt-1 text-[11px] text-white/55">{rankTone}</p>
        </div>
        <Link
          href="/leaderboard"
          className="rounded-xl border border-neon-purple/40 bg-neon-purple/15 px-3 py-2 text-[10px] font-black uppercase tracking-[0.12em] text-neon-purple hover:bg-neon-purple/20 transition-colors"
        >
          Полная гонка
        </Link>
      </div>

      <div className="mt-4 grid gap-2 sm:grid-cols-3">
        <div className="rounded-2xl border border-white/15 bg-black/25 p-3">
          <p className="text-[10px] uppercase tracking-[0.08em] text-white/45">Текущий ранг</p>
          <p className="text-lg font-black text-neon-purple">#{my.rank}</p>
          <p className="mt-1 text-[10px] uppercase tracking-[0.08em] text-white/45">
            {my.rank <= 10 ? "видимая зона" : "идёшь вверх"}
          </p>
        </div>
        <div className="rounded-2xl border border-white/15 bg-black/25 p-3">
          <p className="text-[10px] uppercase tracking-[0.08em] text-white/45">До следующего</p>
          <p className="text-lg font-black text-neon-green">{my.distanceToNext > 0 ? `+${my.distanceToNext}` : "Обгон"}</p>
          <p className="mt-1 text-[10px] uppercase tracking-[0.08em] text-white/45">{getDistanceTone(my.distanceToNext)}</p>
        </div>
        <div className="rounded-2xl border border-white/15 bg-black/25 p-3">
          <p className="text-[10px] uppercase tracking-[0.08em] text-white/45">До топ-10</p>
          <p className="text-lg font-black text-neon-pink">
            {my.distanceToTop10 > 0 ? `+${my.distanceToTop10}` : "В топ-10"}
          </p>
          <p className="mt-1 text-[10px] uppercase tracking-[0.08em] text-white/45">
            {my.distanceToTop10 <= 0 ? "держи темп" : getDistanceTone(my.distanceToTop10)}
          </p>
        </div>
      </div>

      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        <div className="rounded-2xl border border-neon-green/20 bg-black/20 p-3">
          <p className="text-[10px] uppercase tracking-[0.08em] text-neon-green/80">Следующий уровень</p>
          <p className="mt-2 text-sm font-black text-white">
            {nextTier ? `${nextTier.label} через +${nextTier.threshold - auraPoints}` : "Максимальный уровень уже открыт"}
          </p>
          <p className="mt-1 text-[10px] uppercase tracking-[0.08em] text-white/50">
            {nextTier ? "Это ближайший большой визуальный апгрейд карточки." : "Сейчас важнее удерживать видимость и титулы."}
          </p>
        </div>
        <div className="rounded-2xl border border-neon-pink/20 bg-black/20 p-3">
          <p className="text-[10px] uppercase tracking-[0.08em] text-neon-pink/80">Серия</p>
          <p className="mt-2 text-sm font-black text-white">
            {dailyStreak > 0 ? `${dailyStreak} дн. подряд` : "Серия ещё не запущена"}
          </p>
          <p className="mt-1 text-[10px] uppercase tracking-[0.08em] text-white/50">
            {nextStreak ? `До следующего milestone ещё ${nextStreak - dailyStreak} дн.` : "Ты уже на длинной серии. Не отпускай ритм."}
          </p>
        </div>
      </div>

      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        {my.above ? (
          <Link
            href={`/check/${my.above.username}?returnTo=profile`}
            className="rounded-2xl border border-white/15 bg-black/25 px-3 py-2 hover:border-neon-green/45 transition-colors"
          >
            <p className="text-[10px] uppercase tracking-[0.08em] text-white/45">Выше тебя</p>
            <p className="truncate text-sm text-white/90">{my.above.displayName}</p>
            <p className="mt-1 text-[10px] uppercase tracking-[0.08em] text-white/45">{my.above.auraPoints} aura</p>
          </Link>
        ) : (
          <div className="rounded-2xl border border-neon-green/30 bg-neon-green/10 px-3 py-2">
            <p className="text-[10px] uppercase tracking-[0.08em] text-neon-green/85">Ты первый</p>
          </div>
        )}

        {my.below ? (
          <Link
            href={`/check/${my.below.username}?returnTo=profile`}
            className="rounded-2xl border border-white/15 bg-black/25 px-3 py-2 hover:border-neon-pink/45 transition-colors"
          >
            <p className="text-[10px] uppercase tracking-[0.08em] text-white/45">Ниже тебя</p>
            <p className="truncate text-sm text-white/90">{my.below.displayName}</p>
            <p className="mt-1 text-[10px] uppercase tracking-[0.08em] text-white/45">{my.below.auraPoints} aura</p>
          </Link>
        ) : (
          <div className="rounded-2xl border border-white/15 bg-black/25 px-3 py-2">
            <p className="text-[10px] uppercase tracking-[0.08em] text-white/55">Ниже нет игроков</p>
          </div>
        )}
      </div>

      {weeklyTitles.length > 0 && (
        <div className="mt-3">
          <p className="mb-2 text-[10px] font-black uppercase tracking-[0.12em] text-white/55">Текущие титулы</p>
          <div className="flex flex-wrap gap-2">
            {weeklyTitles.map((title) => (
              <span
                key={title.key}
                className="rounded-full border border-neon-pink/35 bg-neon-pink/10 px-2.5 py-1 text-[9px] font-black uppercase tracking-[0.1em] text-neon-pink"
              >
                {title.title}
              </span>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
