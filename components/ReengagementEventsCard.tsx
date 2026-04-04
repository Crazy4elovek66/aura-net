interface ReengagementEvent {
  id: string;
  event_type: string;
  status: string;
  created_at: string;
  scheduled_for: string;
}

interface ReengagementEventsCardProps {
  events: ReengagementEvent[];
}

const EVENT_LABELS: Record<string, string> = {
  new_vote: "Новый голос",
  streak_reminder: "Напоминание о серии",
  leaderboard_top10_entered: "Вход в топ-10",
  leaderboard_top10_dropped: "Вылет из топ-10",
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

export default function ReengagementEventsCard({ events }: ReengagementEventsCardProps) {
  return (
    <section className="w-full max-w-xl rounded-3xl border border-white/10 bg-black/30 backdrop-blur-md p-5">
      <h2 className="text-[10px] font-black uppercase tracking-[0.2em] text-white/70">Петля возврата</h2>
      <p className="mt-2 text-[11px] text-white/45">Основа под Telegram-уведомления: события, очередь, статусы.</p>

      <div className="mt-3 space-y-2">
        {events.length ? (
          events.map((event) => (
            <div key={event.id} className="rounded-2xl border border-white/10 bg-white/[0.02] px-3 py-2">
              <div className="flex items-center justify-between gap-2">
                <p className="text-[11px] text-white/85">{EVENT_LABELS[event.event_type] || event.event_type}</p>
                <p className="text-[10px] uppercase tracking-[0.08em] text-white/55">{STATUS_LABELS[event.status] || event.status}</p>
              </div>
              <p className="mt-1 text-[10px] uppercase tracking-[0.08em] text-white/45">
                {formatDate(event.created_at)} UTC+0 · план: {formatDate(event.scheduled_for)} UTC+0
              </p>
            </div>
          ))
        ) : (
          <p className="rounded-2xl border border-white/10 bg-white/[0.02] px-3 py-2 text-[11px] text-white/55">
            Событий пока нет. Они появятся после голосов, наград и изменения позиции в рейтинге.
          </p>
        )}
      </div>
    </section>
  );
}
