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
}

export default function ProfileRaceCard({ raceContext, weeklyTitles }: ProfileRaceCardProps) {
  if (!raceContext) {
    return (
      <section className="w-full max-w-xl rounded-3xl border border-white/10 bg-black/30 backdrop-blur-md p-5">
        <p className="text-[11px] text-white/55">Персональная гонка появится после входа в аккаунт.</p>
      </section>
    );
  }

  const my = raceContext;

  return (
    <section className="w-full max-w-xl rounded-3xl border border-neon-purple/30 bg-neon-purple/10 backdrop-blur-md p-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-[10px] font-black uppercase tracking-[0.18em] text-white/75">Локальная гонка</h2>
          <p className="text-[11px] text-white/50 mt-1">Твоя цель: двигаться на место выше каждый день.</p>
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
        </div>
        <div className="rounded-2xl border border-white/15 bg-black/25 p-3">
          <p className="text-[10px] uppercase tracking-[0.08em] text-white/45">До следующего</p>
          <p className="text-lg font-black text-neon-green">+{my.distanceToNext}</p>
        </div>
        <div className="rounded-2xl border border-white/15 bg-black/25 p-3">
          <p className="text-[10px] uppercase tracking-[0.08em] text-white/45">До топ-10</p>
          <p className="text-lg font-black text-neon-pink">{my.distanceToTop10 > 0 ? `+${my.distanceToTop10}` : "В топ-10"}</p>
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
          </Link>
        ) : (
          <div className="rounded-2xl border border-white/15 bg-black/25 px-3 py-2">
            <p className="text-[10px] uppercase tracking-[0.08em] text-white/55">Ниже нет игроков</p>
          </div>
        )}
      </div>

      {weeklyTitles.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {weeklyTitles.map((title) => (
            <span
              key={title.key}
              className="rounded-full border border-neon-pink/35 bg-neon-pink/10 px-2.5 py-1 text-[9px] font-black uppercase tracking-[0.1em] text-neon-pink"
            >
              {title.title}
            </span>
          ))}
        </div>
      )}
    </section>
  );
}
