interface ShareableMoment {
  id: string;
  moment_type: string;
  payload?: Record<string, unknown> | null;
  created_at: string;
}

const MOMENT_LABELS: Record<string, string> = {
  achievement_unlocked: "Новое достижение",
  tier_reached: "Новый tier",
  weekly_title_awarded: "Weekly title",
  streak_milestone: "Этап серии",
  leaderboard_top10_entered: "Вход в топ-10",
  referral_activated: "Активированный invite",
};

function getMomentDescription(moment: ShareableMoment) {
  const payload = moment.payload || {};

  if (moment.moment_type === "achievement_unlocked") {
    return typeof payload.achievementTitle === "string" ? payload.achievementTitle : "Достижение открыто";
  }

  if (moment.moment_type === "tier_reached") {
    return typeof payload.tierLabel === "string" ? payload.tierLabel : "Новый статус";
  }

  if (moment.moment_type === "weekly_title_awarded") {
    return typeof payload.title === "string" ? payload.title : "Новый weekly title";
  }

  if (moment.moment_type === "streak_milestone") {
    return typeof payload.milestoneDays === "number" ? `${payload.milestoneDays} дней` : "Новая серия";
  }

  if (moment.moment_type === "leaderboard_top10_entered") {
    return typeof payload.rank === "number" ? `Позиция #${payload.rank}` : "Новый публичный статус";
  }

  if (moment.moment_type === "referral_activated") {
    return typeof payload.inviterReward === "number" ? `+${payload.inviterReward} ауры` : "Приглашение активировано";
  }

  return "Готово к шерингу";
}

export default function ShareableMomentsCard({ moments }: { moments: ShareableMoment[] }) {
  return (
    <section className="w-full max-w-xl rounded-3xl border border-white/10 bg-black/30 p-5 backdrop-blur-md">
      <h2 className="text-[10px] font-black uppercase tracking-[0.2em] text-white/70">Share Hooks</h2>
      <p className="mt-2 text-[11px] text-white/45">Технические поводы для шеринга: tier, title, streak, achievement, top.</p>

      <div className="mt-3 space-y-2">
        {moments.length ? (
          moments.map((moment) => (
            <div key={moment.id} className="rounded-2xl border border-white/10 bg-white/[0.02] px-3 py-2">
              <div className="flex items-center justify-between gap-2">
                <p className="text-[11px] text-white/85">{MOMENT_LABELS[moment.moment_type] || moment.moment_type}</p>
                <p className="text-[9px] uppercase tracking-[0.08em] text-white/40">{new Date(moment.created_at).toLocaleString("ru-RU")}</p>
              </div>
              <p className="mt-1 text-[10px] uppercase tracking-[0.08em] text-white/55">{getMomentDescription(moment)}</p>
            </div>
          ))
        ) : (
          <p className="rounded-2xl border border-white/10 bg-white/[0.02] px-3 py-2 text-[11px] text-white/55">
            Поводы для шеринга появятся после достижений, tier jumps, weekly titles и публичных апдейтов.
          </p>
        )}
      </div>
    </section>
  );
}
