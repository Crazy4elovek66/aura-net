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
  decay: "Decay",
  vote_up: "Получен плюс",
  vote_down: "Получен минус",
  daily_reward: "Daily reward",
};

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
                <p className="text-[10px] text-white/50 truncate">{tx.description || "Без описания"}</p>
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

