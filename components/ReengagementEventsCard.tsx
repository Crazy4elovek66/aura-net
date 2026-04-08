interface ReengagementEvent {
  id: string;
  event_type: string;
  status: string;
  created_at: string;
  scheduled_for: string;
  payload?: Record<string, unknown>;
}

interface ReengagementEventsCardProps {
  events: ReengagementEvent[];
}

const EVENT_LABELS: Record<string, string> = {
  new_vote: "Новый голос",
  streak_reminder: "Напоминание о серии",
  leaderboard_top10_entered: "Вход в топ-10",
  leaderboard_top10_dropped: "Вылет из топ-10",
  weekly_title_awarded: "Weekly title",
  tier_reached: "Новый tier",
};

const STATUS_LABELS: Record<string, string> = {
  pending: "В очереди",
  processing: "Обработка",
  sent: "Отправлено",
  failed: "Ошибка",
  skipped: "Пропущено",
};

function formatDate(iso: string) {
  if (!iso) return "-";

  return new Date(iso).toLocaleString("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function getDetails(event: ReengagementEvent) {
  const payload = event.payload || {};

  if (event.event_type === "new_vote") {
    const auraChange = typeof payload.auraChange === "number" ? payload.auraChange : Number(payload.auraChange || 0);
    return `Изменение: ${auraChange >= 0 ? `+${auraChange}` : auraChange}`;
  }

  if (event.event_type === "leaderboard_top10_entered" && typeof payload.rank === "number") {
    return `Позиция: #${payload.rank}`;
  }

  if (event.event_type === "weekly_title_awarded" && typeof payload.title === "string") {
    return payload.title;
  }

  if (event.event_type === "tier_reached" && typeof payload.tierLabel === "string") {
    return payload.tierLabel;
  }

  return null;
}

export default function ReengagementEventsCard({ events }: ReengagementEventsCardProps) {
  return (
    <section className="w-full max-w-xl rounded-3xl border border-white/10 bg-black/30 p-5 backdrop-blur-md">
      <h2 className="text-[10px] font-black uppercase tracking-[0.2em] text-white/70">Петля возврата</h2>
      <p className="mt-2 text-[11px] text-white/45">Telegram-очередь с dedupe, статусами и полезными trigger-сценариями.</p>

      <div className="mt-3 space-y-2">
        {events.length ? (
          events.map((event) => (
            <div key={event.id} className="rounded-2xl border border-white/10 bg-white/[0.02] px-3 py-2">
              <div className="flex items-center justify-between gap-2">
                <p className="text-[11px] text-white/85">{EVENT_LABELS[event.event_type] || event.event_type}</p>
                <p className="text-[10px] uppercase tracking-[0.08em] text-white/55">{STATUS_LABELS[event.status] || event.status}</p>
              </div>
              {getDetails(event) ? <p className="mt-1 text-[10px] uppercase tracking-[0.08em] text-white/60">{getDetails(event)}</p> : null}
              <p className="mt-1 text-[10px] uppercase tracking-[0.08em] text-white/45">
                {formatDate(event.created_at)} UTC+0 · план: {formatDate(event.scheduled_for)} UTC+0
              </p>
            </div>
          ))
        ) : (
          <p className="rounded-2xl border border-white/10 bg-white/[0.02] px-3 py-2 text-[11px] text-white/55">
            Событий пока нет. Они появятся после голосов, tier jumps, weekly titles и движения по рейтингу.
          </p>
        )}
      </div>
    </section>
  );
}
