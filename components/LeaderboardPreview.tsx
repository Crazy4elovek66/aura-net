import Link from "next/link";

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

interface SpotlightLeader {
  id: string;
  username: string;
  displayName: string;
  auraPoints: number;
  spotlightUntil: string;
}

interface LeaderboardPreviewProps {
  auraLeaders: AuraLeader[];
  growthLeaders: GrowthLeader[];
  spotlightLeaders?: SpotlightLeader[];
  currentUserId?: string;
  variant?: "profile" | "landing";
  title?: string;
  subtitle?: string;
}

const UI_TEXT = {
  titleLanding: "Лидеры ауры",
  titleProfile: "Основные лидеры",
  subtitleLanding: "Кого сейчас обсуждают и кто растет быстрее всех.",
  spotlightTitle: "Сейчас в фокусе",
  auraTop: "Топ по общей ауре",
  growthTop: "Рост за 7 дней",
  growthEmpty: "Пока нет данных по росту.",
};

function rowClass(isCurrentUser: boolean, isLanding: boolean) {
  if (isCurrentUser) {
    return isLanding ? "border-neon-purple/50 bg-neon-purple/12" : "border-neon-purple/40 bg-neon-purple/10";
  }

  return isLanding ? "border-white/12 bg-white/[0.03]" : "border-white/10 bg-white/[0.02]";
}

function formatSpotlightUntil(iso: string) {
  return new Date(iso).toLocaleString("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function LeaderboardPreview({
  auraLeaders,
  growthLeaders,
  spotlightLeaders = [],
  currentUserId = "",
  variant = "profile",
  title,
  subtitle,
}: LeaderboardPreviewProps) {
  const isLanding = variant === "landing";
  const returnTo = variant === "profile" ? "profile" : "home";

  const resolvedTitle = title ?? (isLanding ? UI_TEXT.titleLanding : UI_TEXT.titleProfile);
  const resolvedSubtitle = subtitle ?? (isLanding ? UI_TEXT.subtitleLanding : "");

  return (
    <section
      className={
        isLanding
          ? "w-full rounded-[2rem] border border-white/15 bg-black/35 backdrop-blur-xl p-5 md:p-7 shadow-[0_0_35px_rgba(168,85,247,0.2)]"
          : "w-full max-w-xl rounded-3xl border border-white/10 bg-black/30 backdrop-blur-md p-5"
      }
    >
      <div className={isLanding ? "mb-5" : "mb-4"}>
        <h2
          className={
            isLanding
              ? "text-lg sm:text-xl font-black uppercase tracking-[0.16em] text-white"
              : "text-[10px] font-black uppercase tracking-[0.2em] text-white/70"
          }
        >
          {resolvedTitle}
        </h2>
        {resolvedSubtitle ? (
          <p className={isLanding ? "mt-2 text-sm text-white/60" : "mt-2 text-[11px] text-white/45"}>{resolvedSubtitle}</p>
        ) : null}
      </div>

      {spotlightLeaders.length > 0 && (
        <div className="mb-4 rounded-2xl border border-neon-pink/25 bg-neon-pink/[0.06] p-3">
          <p className="mb-2 text-[10px] uppercase tracking-[0.12em] text-neon-pink/90">{UI_TEXT.spotlightTitle}</p>
          <div className="space-y-2">
            {spotlightLeaders.map((leader) => (
              <Link
                key={leader.id}
                href={`/check/${leader.username}?returnTo=${returnTo}`}
                className="flex items-center justify-between rounded-xl border border-neon-pink/20 bg-black/25 px-3 py-2 transition-colors hover:border-neon-pink/40"
              >
                <div className="min-w-0 pr-3">
                  <p className="truncate text-[11px] text-white/90">{leader.displayName}</p>
                  <p className="text-[9px] uppercase tracking-[0.1em] text-white/45">
                    До {formatSpotlightUntil(leader.spotlightUntil)} UTC+0
                  </p>
                </div>
                <p className="text-[11px] font-black text-neon-pink">{leader.auraPoints}</p>
              </Link>
            ))}
          </div>
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        <div className={isLanding ? "rounded-2xl border border-white/10 bg-black/25 p-4" : ""}>
          <p className="mb-2 text-[10px] uppercase tracking-[0.12em] text-neon-green/90">{UI_TEXT.auraTop}</p>
          <div className="space-y-2">
            {auraLeaders.map((leader, index) => (
              <Link
                key={leader.id}
                href={`/check/${leader.username}?returnTo=${returnTo}`}
                className={`flex items-center justify-between rounded-xl border px-3 py-2 transition-colors hover:border-neon-purple/40 ${rowClass(
                  leader.id === currentUserId,
                  isLanding,
                )}`}
              >
                <p className="truncate pr-3 text-[11px] text-white/85">
                  <span className="mr-2 text-white/45">#{index + 1}</span>
                  {leader.displayName}
                </p>
                <p className="text-[11px] font-black text-neon-green">{leader.auraPoints}</p>
              </Link>
            ))}
          </div>
        </div>

        <div className={isLanding ? "rounded-2xl border border-white/10 bg-black/25 p-4" : ""}>
          <p className="mb-2 text-[10px] uppercase tracking-[0.12em] text-neon-pink/90">{UI_TEXT.growthTop}</p>
          <div className="space-y-2">
            {growthLeaders.length ? (
              growthLeaders.map((leader, index) => (
                <Link
                  key={leader.id}
                  href={`/check/${leader.username}?returnTo=${returnTo}`}
                  className={`flex items-center justify-between rounded-xl border px-3 py-2 transition-colors hover:border-neon-purple/40 ${rowClass(
                    leader.id === currentUserId,
                    isLanding,
                  )}`}
                >
                  <p className="truncate pr-3 text-[11px] text-white/85">
                    <span className="mr-2 text-white/45">#{index + 1}</span>
                    {leader.displayName}
                  </p>
                  <p className="text-[11px] font-black text-neon-pink">+{leader.growthPoints}</p>
                </Link>
              ))
            ) : (
              <p className="rounded-xl border border-white/10 bg-white/[0.02] px-3 py-2 text-[11px] text-white/55">
                {UI_TEXT.growthEmpty}
              </p>
            )}
          </div>
        </div>
      </div>

      <div className="mt-4 flex justify-end">
        <Link
          href="/leaderboard"
          className="rounded-xl border border-neon-purple/35 bg-neon-purple/10 px-3 py-2 text-[10px] font-black uppercase tracking-[0.12em] text-neon-purple hover:bg-neon-purple/15 transition-colors"
        >
          Открыть полную гонку
        </Link>
      </div>
    </section>
  );
}

