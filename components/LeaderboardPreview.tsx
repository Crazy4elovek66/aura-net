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
  titleLanding: "\u041b\u0438\u0434\u0435\u0440\u044b \u0430\u0443\u0440\u044b",
  titleProfile: "\u041e\u0441\u043d\u043e\u0432\u043d\u044b\u0435 \u043b\u0438\u0434\u0435\u0440\u044b",
  subtitleLanding:
    "\u041a\u043e\u0433\u043e \u0441\u0435\u0439\u0447\u0430\u0441 \u043e\u0431\u0441\u0443\u0436\u0434\u0430\u044e\u0442 \u0438 \u043a\u0442\u043e \u0440\u0430\u0441\u0442\u0435\u0442 \u0431\u044b\u0441\u0442\u0440\u0435\u0435 \u0432\u0441\u0435\u0445.",
  auraTop: "\u0422\u043e\u043f \u043f\u043e \u043e\u0431\u0449\u0435\u0439 \u0430\u0443\u0440\u0435",
  growthTop: "\u0420\u043e\u0441\u0442 \u0437\u0430 7 \u0434\u043d\u0435\u0439",
  growthEmpty: "\u041f\u043e\u043a\u0430 \u043d\u0435\u0442 \u0434\u0430\u043d\u043d\u044b\u0445 \u043f\u043e \u0440\u043e\u0441\u0442\u0443.",
};

function rowClass(isCurrentUser: boolean, isLanding: boolean) {
  if (isCurrentUser) {
    return isLanding
      ? "border-neon-purple/50 bg-neon-purple/12"
      : "border-neon-purple/40 bg-neon-purple/10";
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
              <div
                key={leader.id}
                className={`flex items-center justify-between rounded-xl border px-3 py-2 transition-colors ${rowClass(
                  leader.id === currentUserId,
                  isLanding,
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

        <div className={isLanding ? "rounded-2xl border border-white/10 bg-black/25 p-4" : ""}>
          <p className="mb-2 text-[10px] uppercase tracking-[0.12em] text-neon-pink/90">{UI_TEXT.growthTop}</p>
          <div className="space-y-2">
            {growthLeaders.length ? (
              growthLeaders.map((leader, index) => (
                <div
                  key={leader.id}
                  className={`flex items-center justify-between rounded-xl border px-3 py-2 transition-colors ${rowClass(
                    leader.id === currentUserId,
                    isLanding,
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
                {UI_TEXT.growthEmpty}
              </p>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
