"use client";

import { motion } from "framer-motion";
import { useEffect, useState, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const [mounted, setMounted] = useState(false);
  const [loading, setLoading] = useState(true);
  const [tmaDetected, setTmaDetected] = useState(false);
  const scriptContainerRef = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    setMounted(true);
    
    // Проверка на запуск внутри Telegram
    const tg = (window as any).Telegram?.WebApp;
    if (tg && tg.initData && tg.initData.length > 0) {
      setTmaDetected(true);
      
      const handleTmaLogin = async () => {
        try {
          console.log("[TMA] Starting auth with initData...");
          const response = await fetch("/api/auth/telegram", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ 
              initData: tg.initData,
              origin: window.location.origin
            })
          });
          
          if (!response.ok) {
            const errorData = await response.json().catch(() => ({ error: "Ошибка сервера" }));
            throw new Error(errorData.error || "Сбой API");
          }

          const { email, password } = await response.json();
          console.log("[TMA] Credentials received, signing in...");

          // Очищаем любую зависшую/испорченную сессию перед новым входом
          await supabase.auth.signOut();

          // Финальный шаг: устанавливаем сессию через пароль
          const { error: signInError } = await supabase.auth.signInWithPassword({
            email,
            password
          });

          if (signInError) throw signInError;

          console.log("[TMA] Auth success! Redirecting...");
          // Т.к. сессия установлена, идем проверять ник (через перезагрузку для срабатывания мидлвара)
          window.location.href = "/"; 
        } catch (e: any) {
          setError(`Ошибка авторизации: ${e.message}`);
          console.error("TMA Login Error:", e);
        } finally {
          setLoading(false);
        }
      };
      handleTmaLogin();
    } else {
      // Обычный браузер - грузим виджет
      const timer = setTimeout(() => {
        if (scriptContainerRef.current) {
          const script = document.createElement("script");
          script.src = "https://telegram.org/js/telegram-widget.js?22";
          script.setAttribute("data-telegram-login", process.env.NEXT_PUBLIC_TELEGRAM_BOT_NAME || "");
          script.setAttribute("data-size", "large");
          script.setAttribute("data-radius", "10");
          script.setAttribute("data-auth-url", "/api/auth/telegram");
          script.setAttribute("data-request-access", "write");
          script.async = true;
          
          scriptContainerRef.current.appendChild(script);
        }
        setLoading(false);
      }, 1000);

      return () => clearTimeout(timer);
    }
  }, []);

  if (!mounted) return null;

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-black relative overflow-hidden font-unbounded">
      {/* Сетка на фоне */}
      <div className="absolute inset-0 grid-bg opacity-30" />

      {/* Фоновое свечение */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-neon-purple/20 blur-[120px] rounded-full" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-neon-pink/10 blur-[120px] rounded-full" />
      </div>

      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="w-full max-w-md relative z-10"
      >
        <div className="neo-card rounded-3xl p-10 text-center border-2 border-card-border bg-card/50 backdrop-blur-xl">
          <Link href="/" className="inline-block mb-10">
            <h1 className="text-4xl font-black tracking-tighter italic">
              AURA<span className="text-neon-purple">.NET</span>
            </h1>
          </Link>

          <h2 className="text-2xl font-bold mb-3">
            {tmaDetected ? "Авторизация..." : "Добро пожаловать"}
          </h2>
          <p className="text-muted mb-10 italic text-sm">
            {tmaDetected ? "Входим в твой аккаунт через Telegram" : "Стань частью ауры за один клик ⚡"}
          </p>

          <div className="flex flex-col items-center justify-center min-h-[120px] gap-6">
            {error && (
              <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/50 text-red-500 text-xs font-mono mb-4">
                {error}
              </div>
            )}

            {loading && !error && (
              <div className="flex flex-col items-center gap-4">
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                  className="w-8 h-8 border-4 border-neon-purple border-t-transparent rounded-full"
                />
                <span className="text-muted text-xs uppercase tracking-widest font-bold">
                  {tmaDetected ? "Проверка данных..." : "Инициализация..."}
                </span>
              </div>
            )}

            {!tmaDetected && (
              <div
                ref={scriptContainerRef}
                className={`transition-all duration-700 transform ${loading ? 'opacity-0 scale-95 h-0' : 'opacity-100 scale-100'}`}
              >
                {/* Сюда вставится виджет Telegram */}
              </div>
            )}

            <div className="mt-6 text-[10px] text-muted/60 max-w-[260px] leading-relaxed uppercase tracking-tighter font-medium">
              Мы используем безопасный вход через официальный Telegram SDK. Твои данные в безопасности.
            </div>
          </div>

          <div className="mt-12 pt-8 border-t border-card-border">
            <Link
              href="/"
              className="text-muted hover:text-white transition-colors text-xs font-bold uppercase tracking-widest"
            >
              ← Назад
            </Link>
          </div>
        </div>

        <p className="mt-8 text-center text-[10px] text-muted/40 uppercase tracking-widest font-medium">
          Входя, ты подтверждаешь, что ты не НПС 🫡
        </p>
      </motion.div>
    </div>
  );
}
