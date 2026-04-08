"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { createClient } from "@/lib/supabase/client";

export default function SetupProfilePage() {
  const [username, setUsername] = useState("");
  const [status, setStatus] = useState<"idle" | "checking" | "available" | "taken" | "invalid">("idle");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const supabase = createClient();
  const getErrorMessage = (errorValue: unknown) =>
    errorValue instanceof Error
      ? errorValue.message
      : "Ошибка базы данных. Проверь SQL-триггеры!";

  // Валидация ника (Кириллица, Латиница, Цифры, Подчеркивание)
  const validateUsername = (val: string) => {
    const regex = /^[a-zA-Z0-9а-яА-ЯёЁ_]{3,20}$/;
    return regex.test(val);
  };

  useEffect(() => {
    const checkUsername = async () => {
      if (username.length === 0) {
        setStatus("idle");
        setError("");
        return;
      }

      if (username.length < 3) {
        setStatus("invalid");
        setError("Минимум 3 символа");
        return;
      }

      if (username.length > 20) {
        setStatus("invalid");
        setError("Максимум 20 символов");
        return;
      }

      if (!validateUsername(username)) {
        setStatus("invalid");
        setError("Только буквы, цифры и подчеркивание (_) — без пробелов!");
        return;
      }

      setStatus("checking");
      try {
        const res = await fetch(`/api/check-username?username=${encodeURIComponent(username)}`);
        const data = await res.json();
        
        if (data.available) {
          setStatus("available");
          setError("");
        } else {
          setStatus("taken");
          setError("Этот ник уже занят другим героем");
        }
      } catch (err) {
        console.error(err);
      }
    };

    const timer = setTimeout(checkUsername, 500);
    return () => clearTimeout(timer);
  }, [username]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (status !== "available" || loading) return;

    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Пользователь не найден");

      const { error: updateError } = await supabase
        .from("profiles")
        .update({ 
          username: username.trim(),
          display_name: username.trim(), // Синхронизируем display_name
          is_nickname_selected: true 
        })
        .eq("id", user.id);

      if (updateError) throw updateError;

      // Даем базе полсекунды на "прогрев" и сбрасываем кэш роутера
      router.refresh();
      await new Promise(resolve => setTimeout(resolve, 500));

      // Жесткий редирект
      window.location.replace("/profile");
    } catch (err: unknown) {
      setError(getErrorMessage(err));
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-black text-white flex items-center justify-center p-4 font-unbounded overflow-hidden">
      {/* Background Decor */}
      <div className="fixed inset-0 pointer-events-none opacity-30">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-neon-purple/20 rounded-full blur-[120px]" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-neon-pink/20 rounded-full blur-[120px]" />
      </div>

      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="w-full max-w-md relative z-10"
      >
        <div className="text-center mb-10">
          <motion.div
            initial={{ y: -20 }}
            animate={{ y: 0 }}
            className="inline-block p-4 rounded-2xl bg-gradient-to-br from-neon-purple/20 to-neon-pink/20 border border-white/10 mb-6"
          >
            <span className="text-4xl">🎭</span>
          </motion.div>
          <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white via-neon-purple to-neon-pink">
            ФИНАЛЬНЫЙ ШТРИХ
          </h1>
          <p className="text-muted text-sm mt-3 uppercase tracking-widest">
            ВЫБЕРИ СВОЁ ИМЯ В СИСТЕМЕ
          </p>
        </div>

        <form onSubmit={handleSave} className="space-y-6">
          <div className="relative">
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Твой никнейм..."
              className={`w-full bg-black/50 border-2 p-5 rounded-2xl text-lg transition-all outline-none ${
                status === "available" ? "border-neon-green text-neon-green" :
                status === "taken" || status === "invalid" ? "border-neon-pink text-neon-pink" :
                "border-card-border focus:border-neon-purple"
              }`}
              required
            />
            
            <div className="absolute right-4 top-1/2 -translate-y-1/2 flex items-center gap-2">
              <AnimatePresence mode="wait">
                {status === "checking" && (
                  <motion.div
                    key="load"
                    animate={{ rotate: 360 }}
                    transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                    className="w-5 h-5 border-2 border-neon-purple border-t-transparent rounded-full"
                  />
                )}
                {status === "available" && (
                  <motion.span key="ok" initial={{ scale: 0 }} animate={{ scale: 1 }} className="text-neon-green font-bold">
                    OK
                  </motion.span>
                )}
                {(status === "taken" || status === "invalid") && (
                  <motion.span key="no" initial={{ scale: 0 }} animate={{ scale: 1 }} className="text-neon-pink font-bold">
                    !
                  </motion.span>
                )}
              </AnimatePresence>
            </div>
          </div>

          <AnimatePresence>
            {error && (
              <motion.p
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="text-neon-pink text-[10px] font-bold uppercase tracking-widest px-1"
              >
                {error}
              </motion.p>
            )}
          </AnimatePresence>

          <button
            type="submit"
            disabled={status !== "available" || loading}
            className={`w-full py-5 rounded-2xl font-bold transition-all relative overflow-hidden group ${
              status === "available" 
                ? "bg-white text-black hover:scale-[1.02] shadow-[0_0_20px_rgba(255,255,255,0.3)]" 
                : "bg-card-border text-muted cursor-not-allowed"
            }`}
          >
            {loading ? "СОХРАНЯЕМ..." : "СТАТЬ ГЕРОЕМ 🏎️"}
            {status === "available" && (
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000" />
            )}
          </button>
        </form>

        <div className="mt-8 flex flex-col items-center gap-4">
          <p className="text-center text-[10px] text-muted uppercase tracking-[0.2em] leading-relaxed">
            После этого ты получишь свою уникальную карточку <br /> и сможешь начать копить ауру
          </p>
          
          <button
            onClick={async () => {
              await supabase.auth.signOut();
              router.push("/login");
            }}
            className="text-[10px] font-bold text-muted hover:text-neon-pink transition-colors uppercase tracking-widest border-b border-muted/50 hover:border-neon-pink/50 pb-1"
          >
            Выйти из системы
          </button>
        </div>
      </motion.div>
    </div>
  );
}
