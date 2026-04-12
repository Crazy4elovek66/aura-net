import Link from "next/link";

interface CircleProfile {
  id: string;
  username: string;
  displayName: string;
  auraPoints: number;
  relation: "you" | "invited" | "invited_you";
  relationLabel: string;
}

interface MyCircleCardProps {
  circleProfiles: CircleProfile[];
  activatedInvites: number;
  pendingInvites: number;
}

function rowClass(relation: CircleProfile["relation"]) {
  if (relation === "you") {
    return "border-neon-purple/35 bg-neon-purple/10";
  }

  if (relation === "invited_you") {
    return "border-neon-green/25 bg-neon-green/[0.07]";
  }

  return "border-white/10 bg-white/[0.02]";
}

export default function MyCircleCard({ circleProfiles, activatedInvites, pendingInvites }: MyCircleCardProps) {
  if (!circleProfiles.length) {
    return null;
  }

  const myCircleRankIndex = circleProfiles.findIndex((item) => item.relation === "you");
  const myCircleRank = myCircleRankIndex >= 0 ? myCircleRankIndex + 1 : null;

  return (
    <section className="w-full max-w-xl rounded-3xl border border-white/10 bg-black/30 p-5 backdrop-blur-md">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-[10px] font-black uppercase tracking-[0.2em] text-white/70">Твой круг</h2>
          <p className="mt-2 text-[11px] leading-relaxed text-white/55">
            Здесь только те, кто реально связан с тобой: ты, приглашенные и тот, кто тебя привел.
          </p>
        </div>
        <div className="rounded-2xl border border-neon-purple/20 bg-neon-purple/[0.06] px-3 py-2 text-right">
          <p className="text-[9px] uppercase tracking-[0.1em] text-white/45">Связей</p>
          <p className="text-sm font-black text-neon-purple">{circleProfiles.length}</p>
        </div>
      </div>

      <div className="mt-4 grid gap-2 sm:grid-cols-3">
        <div className="rounded-2xl border border-white/10 bg-black/20 p-3">
          <p className="text-[9px] uppercase tracking-[0.1em] text-white/45">Активировано</p>
          <p className="mt-2 text-lg font-black text-neon-green">{activatedInvites}</p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-black/20 p-3">
          <p className="text-[9px] uppercase tracking-[0.1em] text-white/45">Ждут шага</p>
          <p className="mt-2 text-lg font-black text-neon-pink">{pendingInvites}</p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-black/20 p-3">
          <p className="text-[9px] uppercase tracking-[0.1em] text-white/45">Мини-рейтинг</p>
          <p className="mt-2 text-lg font-black text-white">{myCircleRank ? `#${myCircleRank}` : "-"}</p>
        </div>
      </div>

      <div className="mt-4 space-y-2">
        {circleProfiles.map((profile, index) => {
          const content = (
            <>
              <div className="min-w-0 pr-3">
                <p className="truncate text-sm text-white/90">
                  <span className="mr-2 text-white/40">#{index + 1}</span>
                  {profile.displayName}
                </p>
                <p className="text-[10px] uppercase tracking-[0.08em] text-white/45">{profile.relationLabel}</p>
              </div>
              <p className="text-sm font-black text-white">{profile.auraPoints}</p>
            </>
          );

          if (profile.relation === "you") {
            return (
              <div
                key={profile.id}
                className={`flex items-center justify-between rounded-2xl border px-3 py-2 ${rowClass(profile.relation)}`}
              >
                {content}
              </div>
            );
          }

          return (
            <Link
              key={profile.id}
              href={`/check/${profile.username}?returnTo=profile`}
              className={`flex items-center justify-between rounded-2xl border px-3 py-2 transition-colors hover:border-neon-purple/35 ${rowClass(
                profile.relation,
              )}`}
            >
              {content}
            </Link>
          );
        })}
      </div>
    </section>
  );
}
