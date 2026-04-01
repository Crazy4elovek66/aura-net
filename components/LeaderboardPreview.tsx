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

interface LeaderboardPreviewProps {
  auraLeaders: AuraLeader[];
  growthLeaders: GrowthLeader[];
  currentUserId?: string;
  variant?: "profile" | "landing";
  title?: string;
  subtitle?: string;
}

const UI_TEXT = {
  titleLanding: "Лидеры ауры",
  titleProfile: "Основные лидеры",
  subtitleLanding: "Кого сейчас обсуждают и кто растет быстрее всех.",
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

export default function LeaderboardPreview({
  auraLeaders,
  growthLeaders,
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

      <div className={isLanding ? "grid gap-4 md:grid-cols-2" : "grid gap-4 md:grid-cols-2"}>
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
    </section>
  );
}

