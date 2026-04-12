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
          <h2 className="text-[10px] font-black uppercase tracking-[0.2em] text-neon-green/90">С последнего входа</h2>
          <p className="mt-2 text-[11px] leading-relaxed text-white/70">
            {hasTrackedState
              ? `Короткая сводка изменений с ${formatDate(trackedAt)} UTC+0.`
              : "Пока это первый срез. После следующего цикла появится понятная динамика."}
          </p>
        </div>
        <div className="rounded-2xl border border-neon-green/20 bg-black/20 px-3 py-2 text-right">
          <p className="text-[9px] uppercase tracking-[0.1em] text-white/45">Изменение ауры</p>
          <p className={`text-sm font-black ${auraDelta >= 0 ? "text-neon-green" : "text-neon-pink"}`}>
            {auraDelta >= 0 ? `+${auraDelta}` : auraDelta}
          </p>
        </div>
      </div>

      <details className="group mt-3 rounded-2xl border border-white/10 bg-black/20">
        <summary className="list-none cursor-pointer px-4 py-3">
          <p className="text-[10px] font-black uppercase tracking-[0.1em] text-white/70">Показать детали</p>
        </summary>

        <div className="grid gap-2 px-3 pb-3 sm:grid-cols-4">
          <div className="rounded-2xl border border-white/10 bg-black/20 p-3">
            <p className="text-[9px] uppercase tracking-[0.1em] text-white/45">Ранг</p>
            <p className="mt-2 text-lg font-black text-white">{currentRank ? `#${currentRank}` : "—"}</p>
            <p className="mt-1 text-[10px] uppercase tracking-[0.08em] text-white/45">
              {rankShift === null
                ? "без истории"
                : rankShift > 0
                  ? `поднялся на ${rankShift}`
                  : rankShift < 0
                    ? `просел на ${Math.abs(rankShift)}`
                    : "без смены"}
            </p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-black/20 p-3">
            <p className="text-[9px] uppercase tracking-[0.1em] text-white/45">Достижения</p>
            <p className="mt-2 text-lg font-black text-white">{newAchievements}</p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-black/20 p-3">
            <p className="text-[9px] uppercase tracking-[0.1em] text-white/45">Поводы</p>
            <p className="mt-2 text-lg font-black text-white">{newMoments}</p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-black/20 p-3">
            <p className="text-[9px] uppercase tracking-[0.1em] text-white/45">Инвайты</p>
            <p className="mt-2 text-lg font-black text-white">{activatedReferrals}</p>
          </div>
        </div>

        <div className="mx-3 mb-3 rounded-2xl border border-white/10 bg-black/20 p-3">
          <p className="text-[10px] uppercase tracking-[0.1em] text-white/45">Что дальше</p>
          <p className="mt-2 text-[11px] leading-relaxed text-white/68">
            {pendingEvents > 0
              ? `В очереди еще ${pendingEvents} событий. Есть смысл вернуться к карточке и кругу уже сейчас.`
              : "Очередь пустая. Главный фокус сейчас: гонка, голоса и движение по инвайтам."}
          </p>
        </div>
      </details>
    </section>
  );
}
