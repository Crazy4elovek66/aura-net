interface ReturnPulseCardProps {
  trackedAt: string | null;
  currentRank: number | null;
  previousRank: number | null;
  auraDelta: number;
  newAchievements: number;
  newMoments: number;
  activatedReferrals: number;
  pendingEvents: number;
}

function formatDate(iso: string | null) {
  if (!iso) return "сейчас";

  return new Date(iso).toLocaleString("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function getRankShift(currentRank: number | null, previousRank: number | null) {
  if (!currentRank || !previousRank) {
    return null;
  }

  return previousRank - currentRank;
}

export default function ReturnPulseCard({
  trackedAt,
  currentRank,
  previousRank,
  auraDelta,
  newAchievements,
  newMoments,
  activatedReferrals,
  pendingEvents,
}: ReturnPulseCardProps) {
  const rankShift = getRankShift(currentRank, previousRank);
  const hasTrackedState = Boolean(trackedAt);

  return (
    <section className="w-full max-w-xl rounded-3xl border border-neon-green/25 bg-neon-green/[0.07] p-5 backdrop-blur-md">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-[10px] font-black uppercase tracking-[0.2em] text-neon-green/90">Return pulse</h2>
          <p className="mt-2 text-[11px] leading-relaxed text-white/70">
            {hasTrackedState
              ? `Что успело измениться с последнего трекнутого состояния от ${formatDate(trackedAt)} UTC+0.`
              : "Первый заметный срез ещё не накоплен. После следующего круга здесь появится понятная дельта."}
          </p>
        </div>
        <div className="rounded-2xl border border-neon-green/20 bg-black/20 px-3 py-2 text-right">
          <p className="text-[9px] uppercase tracking-[0.1em] text-white/45">Движение</p>
          <p className={`text-sm font-black ${auraDelta >= 0 ? "text-neon-green" : "text-neon-pink"}`}>
            {auraDelta >= 0 ? `+${auraDelta}` : auraDelta}
          </p>
        </div>
      </div>

      <div className="mt-4 grid gap-2 sm:grid-cols-4">
        <div className="rounded-2xl border border-white/10 bg-black/20 p-3">
          <p className="text-[9px] uppercase tracking-[0.1em] text-white/45">Ранг</p>
          <p className="mt-2 text-lg font-black text-white">
            {currentRank ? `#${currentRank}` : "—"}
          </p>
          <p className="mt-1 text-[10px] uppercase tracking-[0.08em] text-white/45">
            {rankShift === null ? "без истории" : rankShift > 0 ? `поднялся на ${rankShift}` : rankShift < 0 ? `просел на ${Math.abs(rankShift)}` : "без смены"}
          </p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-black/20 p-3">
          <p className="text-[9px] uppercase tracking-[0.1em] text-white/45">Достижения</p>
          <p className="mt-2 text-lg font-black text-white">{newAchievements}</p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-black/20 p-3">
          <p className="text-[9px] uppercase tracking-[0.1em] text-white/45">Моменты</p>
          <p className="mt-2 text-lg font-black text-white">{newMoments}</p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-black/20 p-3">
          <p className="text-[9px] uppercase tracking-[0.1em] text-white/45">Инвайт loop</p>
          <p className="mt-2 text-lg font-black text-white">{activatedReferrals}</p>
        </div>
      </div>

      <div className="mt-3 rounded-2xl border border-white/10 bg-black/20 p-3">
        <p className="text-[10px] uppercase tracking-[0.1em] text-white/45">Что ждёт тебя сейчас</p>
        <p className="mt-2 text-[11px] leading-relaxed text-white/68">
          {pendingEvents > 0
            ? `В очереди ещё ${pendingEvents} событий. Есть повод вернуться к карточке, моментам и гонке прямо сейчас.`
            : "Очередь тихая: значит, главный фокус сейчас в гонке, новых голосах и движении твоего круга."}
        </p>
      </div>
    </section>
  );
}
