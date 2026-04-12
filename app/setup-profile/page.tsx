"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { createClient } from "@/lib/supabase/client";

interface DevLoginResponse {
  success?: boolean;
  error?: string;
  email?: string;
  password?: string;
}

export default function SetupProfilePage() {
  const [username, setUsername] = useState("");
  const [status, setStatus] = useState<"idle" | "checking" | "available" | "taken" | "invalid">("idle");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const supabase = createClient();

  const tryRestoreDevSession = async () => {
    const host = window.location.hostname;
    const isLocalhost = host === "localhost" || host === "127.0.0.1" || host === "::1";
    if (!isLocalhost) return null;

    const response = await fetch("/api/auth/dev-login", { method: "POST" });
    const payload = (await response.json().catch(() => ({}))) as DevLoginResponse;

    if (!response.ok || !payload.email || !payload.password) {
      return null;
    }

    const signInResult = await supabase.auth.signInWithPassword({
      email: payload.email,
      password: payload.password,
    });

    if (signInResult.error || !signInResult.data.user) {
      return null;
    }

    return signInResult.data.user;
  };

  const getErrorMessage = (errorValue: unknown) =>
    errorValue instanceof Error ? errorValue.message : "Ошибка базы данных. Проверь SQL-триггеры.";

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
        setError("Только буквы, цифры и подчеркивание (_) — без пробелов");
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
          setError("Этот ник уже занят");
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
      let {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        const { data: sessionData } = await supabase.auth.getSession();
        if (sessionData.session?.user) {
          user = sessionData.session.user;
        }
      }

      if (!user) {
        user = await tryRestoreDevSession();
      }
      if (!user) throw new Error("Пользователь не найден");

      const { error: updateError } = await supabase
        .from("profiles")
        .update({
          username: username.trim(),
          display_name: username.trim(),
          is_nickname_selected: true,
        })
        .eq("id", user.id);

      if (updateError) throw updateError;

      router.refresh();
      await new Promise((resolve) => setTimeout(resolve, 500));
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
            <span className="text-4xl">ID</span>
          </motion.div>
          <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white via-neon-purple to-neon-pink">
            ВЫБЕРИ НИК
          </h1>
          <p className="text-muted text-sm mt-3 uppercase tracking-widest">ЭТО ИМЯ БУДУТ ВИДЕТЬ В КАРТОЧКЕ</p>
        </div>

        <form onSubmit={handleSave} className="space-y-6">
          <div className="relative">
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Например: aura_neo"
              className={`w-full bg-black/50 border-2 p-5 rounded-2xl text-lg transition-all outline-none ${
                status === "available"
                  ? "border-neon-green text-neon-green"
                  : status === "taken" || status === "invalid"
                    ? "border-neon-pink text-neon-pink"
                    : "border-card-border focus:border-neon-purple"
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
            {loading ? "СОХРАНЯЕМ..." : "СОХРАНИТЬ НИК"}
            {status === "available" && (
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000" />
            )}
          </button>
        </form>

        <div className="mt-8 flex flex-col items-center gap-4">
          <p className="text-center text-[10px] text-muted uppercase tracking-[0.2em] leading-relaxed">
            После этого откроется твой профиль и публичная ссылка
          </p>

          <div className="w-full rounded-3xl border border-white/10 bg-black/35 p-5 text-left">
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-neon-green/85">Что дальше</p>
            <div className="mt-3 space-y-2">
              {[
                "1. Получишь личную карточку и ссылку.",
                "2. Увидишь ближайшие шаги роста.",
                "3. Сможешь сразу отправить карточку или инвайт.",
              ].map((step) => (
                <p key={step} className="rounded-2xl border border-white/8 bg-white/[0.02] px-3 py-2 text-[11px] leading-relaxed text-white/68">
                  {step}
                </p>
              ))}
            </div>
          </div>

          <button
            onClick={async () => {
              await supabase.auth.signOut();
              router.push("/login");
            }}
            className="text-[10px] font-bold text-muted hover:text-neon-pink transition-colors uppercase tracking-widest border-b border-muted/50 hover:border-neon-pink/50 pb-1"
          >
            Выйти
          </button>
        </div>
      </motion.div>
    </div>
  );
}
