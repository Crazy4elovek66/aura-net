interface AuraTransaction {
  id: string;
  amount: number;
  type: string;
  description: string | null;
  created_at: string;
}

const TYPE_LABELS: Record<string, string> = {
  tax: "Налог",
  boost: "Буст",
  decay: "Угасание ауры",
  vote_up: "Получен плюс",
  vote_down: "Получен минус",
  daily_reward: "Ежедневная награда",
  streak_milestone: "Этап серии",
  weekly_activity_reward: "Недельная награда",
  achievement_reward: "Награда за достижение",
};

function extractFirstNumber(value: string | null): number | null {
  if (!value) return null;
  const match = value.match(/(\d+)/);
  return match ? Number(match[1]) : null;
}

function formatDescription(tx: AuraTransaction) {
  if (tx.type === "decay") {
    const days = extractFirstNumber(tx.description);
    return days && days > 1 ? `Ежедневное угасание: ${days} дн.` : "Ежедневное угасание";
  }

  if (tx.type === "daily_reward") {
    const day = extractFirstNumber(tx.description);
    return day ? `Награда за серию: день ${day}` : "Награда за серию";
  }

  if (tx.type === "streak_milestone") {
    const days = extractFirstNumber(tx.description);
    return days ? `Этап серии: ${days} дн.` : "Этап серии";
  }

  if (tx.type === "weekly_activity_reward") {
    return tx.description || "Награда за недельную активность";
  }

  if (tx.type === "achievement_reward") {
    return tx.description || "Награда за достижение";
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
      <section className="w-full max-w-xl rounded-3xl border border-white/10 bg-black/30 backdrop-blur-md p-5">
        <h2 className="text-[10px] font-black uppercase tracking-[0.2em] text-white/70 mb-3">История ауры</h2>
        <p className="text-xs text-white/50">Пока нет записей. Первая активность появится здесь.</p>
      </section>
    );
  }

  return (
    <section className="w-full max-w-xl rounded-3xl border border-white/10 bg-black/30 backdrop-blur-md p-5">
      <h2 className="text-[10px] font-black uppercase tracking-[0.2em] text-white/70 mb-3">История ауры</h2>
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
                <p className="text-[10px] text-white/50 truncate">{formatDescription(tx)}</p>
                <p className="text-[9px] uppercase tracking-[0.1em] text-white/35">
                  {new Date(tx.created_at).toLocaleString("ru-RU")}
                </p>
              </div>

              <div className={`text-xs font-black ${amountClass(tx.amount)}`}>{formatAmount(tx.amount)}</div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
