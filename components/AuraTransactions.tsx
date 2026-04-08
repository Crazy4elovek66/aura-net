interface AuraTransaction {
  id: string;
  amount: number;
  type: string;
  description: string | null;
  metadata?: Record<string, unknown> | null;
  created_at: string;
}

const TYPE_LABELS: Record<string, string> = {
  tax: "Налог",
  boost: "Фокус",
  spotlight: "Фокус",
  decay_shield_purchase: "Щит от угасания",
  streak_save: "Сохранение серии",
  card_accent_purchase: "Акцент карточки",
  decay: "Угасание ауры",
  vote_up: "Получен плюс",
  vote_down: "Получен минус",
  daily_reward: "Ежедневная награда",
  streak_milestone: "Этап серии",
  weekly_activity_reward: "Недельная награда",
  achievement_reward: "Награда за достижение",
  referral_inviter_reward: "Invite reward",
  referral_invitee_reward: "Welcome reward",
};

function extractFirstNumber(value: string | null): number | null {
  if (!value) return null;
  const match = value.match(/(\d+)/);
  return match ? Number(match[1]) : null;
}

function getMetadataValue<T>(metadata: Record<string, unknown> | null | undefined, key: string): T | null {
  if (!metadata || !(key in metadata)) return null;
  return metadata[key] as T;
}

function formatDescription(tx: AuraTransaction) {
  const metadata = tx.metadata || null;

  if (tx.type === "decay") {
    const days = extractFirstNumber(tx.description);
    return days && days > 1 ? `Ежедневное угасание: ${days} дн.` : "Ежедневное угасание";
  }

  if (tx.type === "daily_reward") {
    const streak = getMetadataValue<number>(metadata, "streak") ?? extractFirstNumber(tx.description);
    const rewardRole = getMetadataValue<string>(metadata, "rewardRole");
    return `${streak ? `Серия: день ${streak}` : "Награда за серию"}${rewardRole === "supporting" ? " • вспомогательный income" : ""}`;
  }

  if (tx.type === "streak_milestone") {
    const days = getMetadataValue<number>(metadata, "milestoneDays") ?? extractFirstNumber(tx.description);
    return days ? `Этап серии: ${days} дн.` : "Этап серии";
  }

  if (tx.type === "weekly_activity_reward") {
    const activeDays = getMetadataValue<number>(metadata, "activeDays");
    return activeDays ? `Недельная активность: ${activeDays}/7 дней` : tx.description || "Недельная награда";
  }

  if (tx.type === "achievement_reward") {
    const title = getMetadataValue<string>(metadata, "achievementTitle");
    return title || tx.description || "Награда за достижение";
  }

  if (tx.type === "referral_inviter_reward") {
    const inviteeId = getMetadataValue<string>(metadata, "inviteeId");
    return inviteeId ? `Активирован приглашённый ${inviteeId.slice(0, 8)}` : "Активированный приглашённый";
  }

  if (tx.type === "referral_invitee_reward") {
    return "Бонус за вход по приглашению";
  }

  if (tx.type === "spotlight" || tx.type === "boost") {
    return tx.description || "Активация фокуса";
  }

  if (tx.type === "decay_shield_purchase") {
    return tx.description || "Щит от угасания";
  }

  if (tx.type === "streak_save") {
    return tx.description || "Сохранение серии";
  }

  if (tx.type === "card_accent_purchase") {
    return tx.description || "Визуальный акцент карточки";
  }

  return tx.description || "Без описания";
}

function formatAmount(amount: number) {
  const sign = amount > 0 ? "+" : "";
  return `${sign}${amount}`;
}

function amountClass(amount: number) {
  if (amount > 0) return "text-neon-green";
  if (amount < 0) return "text-neon-pink";
  return "text-white/70";
}

export default function AuraTransactions({ transactions }: { transactions: AuraTransaction[] }) {
  if (!transactions.length) {
    return (
      <section className="w-full max-w-xl rounded-3xl border border-white/10 bg-black/30 p-5 backdrop-blur-md">
        <h2 className="mb-3 text-[10px] font-black uppercase tracking-[0.2em] text-white/70">История ауры</h2>
        <p className="text-xs text-white/50">Пока нет записей. Первая активность появится здесь.</p>
      </section>
    );
  }

  return (
    <section className="w-full max-w-xl rounded-3xl border border-white/10 bg-black/30 p-5 backdrop-blur-md">
      <h2 className="mb-1 text-[10px] font-black uppercase tracking-[0.2em] text-white/70">История ауры</h2>
      <p className="mb-3 text-[11px] text-white/45">Каждое изменение баланса логируется без “магических” скачков.</p>

      <div className="space-y-2">
        {transactions.map((tx) => {
          const label = TYPE_LABELS[tx.type] ?? tx.type;

          return (
            <div
              key={tx.id}
              className="flex items-center justify-between rounded-xl border border-white/10 bg-white/[0.02] px-3 py-2"
            >
              <div className="min-w-0 pr-3">
                <p className="text-[10px] font-black uppercase tracking-[0.12em] text-white/80">{label}</p>
                <p className="truncate text-[10px] text-white/55">{formatDescription(tx)}</p>
                <p className="text-[9px] uppercase tracking-[0.1em] text-white/35">{new Date(tx.created_at).toLocaleString("ru-RU")}</p>
              </div>

              <div className={`text-xs font-black ${amountClass(tx.amount)}`}>{formatAmount(tx.amount)}</div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
