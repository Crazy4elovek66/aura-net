interface AuraLeader {
  id: string;
  username: string;
  displayName: string;
  auraPoints: number;
}

interface GrowthLeader {
  id: string;
  username: string;
  displayName: string;
  auraPoints: number;
  growthPoints: number;
}

interface LeaderboardPreviewProps {
  auraLeaders: AuraLeader[];
  growthLeaders: GrowthLeader[];
  currentUserId: string;
}

function rowClass(isCurrentUser: boolean) {
  return isCurrentUser
    ? "border-neon-purple/40 bg-neon-purple/10"
    : "border-white/10 bg-white/[0.02]";
}

export default function LeaderboardPreview({
  auraLeaders,
  growthLeaders,
  currentUserId,
}: LeaderboardPreviewProps) {
  return (
    <section className="w-full max-w-xl rounded-3xl border border-white/10 bg-black/30 backdrop-blur-md p-5">
      <h2 className="text-[10px] font-black uppercase tracking-[0.2em] text-white/70">Leaderboard Preview</h2>

      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <div>
          <p className="mb-2 text-[10px] uppercase tracking-[0.12em] text-neon-green/90">Топ по общей ауре</p>
          <div className="space-y-2">
            {auraLeaders.map((leader, index) => (
              <div
                key={leader.id}
                className={`flex items-center justify-between rounded-xl border px-3 py-2 ${rowClass(
                  leader.id === currentUserId,
                )}`}
              >
                <p className="truncate pr-3 text-[11px] text-white/85">
                  <span className="mr-2 text-white/45">#{index + 1}</span>
                  {leader.displayName}
                </p>
                <p className="text-[11px] font-black text-neon-green">{leader.auraPoints}</p>
              </div>
            ))}
          </div>
        </div>

        <div>
          <p className="mb-2 text-[10px] uppercase tracking-[0.12em] text-neon-pink/90">Рост за 7 дней</p>
          <div className="space-y-2">
            {growthLeaders.length ? (
              growthLeaders.map((leader, index) => (
                <div
                  key={leader.id}
                  className={`flex items-center justify-between rounded-xl border px-3 py-2 ${rowClass(
                    leader.id === currentUserId,
                  )}`}
                >
                  <p className="truncate pr-3 text-[11px] text-white/85">
                    <span className="mr-2 text-white/45">#{index + 1}</span>
                    {leader.displayName}
                  </p>
                  <p className="text-[11px] font-black text-neon-pink">+{leader.growthPoints}</p>
                </div>
              ))
            ) : (
              <p className="rounded-xl border border-white/10 bg-white/[0.02] px-3 py-2 text-[11px] text-white/55">
                Пока нет данных по росту.
              </p>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
