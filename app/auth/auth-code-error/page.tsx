import Link from "next/link";

export default function AuthErrorPage() {
  return (
    <div className="min-h-screen bg-black text-white flex flex-col items-center justify-center p-4 text-center font-unbounded">
      <h1 className="text-4xl font-bold mb-4 text-neon-pink">Ошибка Вайба 💀</h1>
      <p className="text-muted mb-8 max-w-md">
        Не удалось подтвердить твою личность. Возможно, ссылка устарела или произошел сбой в системе.
      </p>
      <Link 
        href="/login" 
        className="px-8 py-4 rounded-xl bg-neon-purple text-white font-bold hover:scale-105 transition-transform"
      >
        Попробовать снова
      </Link>
    </div>
  );
}
