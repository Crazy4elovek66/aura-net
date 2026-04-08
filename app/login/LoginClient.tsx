"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { buildTelegramProfilePatch, type TelegramProfileInput } from "@/lib/auth/telegram-profile";
import { useNotice } from "@/components/notice/NoticeProvider";

const supabase = createClient();

type TelegramWebApp = {
  initData?: string;
};

interface TelegramAuthResponse {
  email: string;
  password: string;
  profile?: TelegramProfileInput;
  referralCode?: string | null;
}

function getErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  return fallback;
}

function mapLoginError(errorCode: string | null, reason: string | null) {
  switch (errorCode) {
    case "config":
      return "Вход через браузер сейчас не работает: серверная Telegram-авторизация не настроена.";
    case "telegram_widget_failed":
      return reason ? `Вход через Telegram сорвался: ${reason}` : "Вход через Telegram сорвался.";
    case "exchange_failed":
      return "Не получилось обменять код авторизации на сессию.";
    case "no_session":
      return "Сессия после входа не появилась. Попробуй ещё раз.";
    default:
      return null;
  }
}

export default function LoginClient({
  errorCode,
  errorReason,
  referralCode,
}: {
  errorCode: string | null;
  errorReason: string | null;
  referralCode: string | null;
}) {
  const [mounted, setMounted] = useState(false);
  const [loading, setLoading] = useState(true);
  const [tmaDetected, setTmaDetected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scriptContainerRef = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const { notify } = useNotice();
  const browserLoginAvailable = Boolean(process.env.NEXT_PUBLIC_TELEGRAM_BOT_NAME);

  const resolvePostLoginPath = useCallback(async (userId: string) => {
    const { data: profile } = await supabase
      .from("profiles")
      .select("is_nickname_selected")
      .eq("id", userId)
      .maybeSingle();

    return !profile || profile.is_nickname_selected === false ? "/setup-profile" : "/profile";
  }, []);

  const syncTelegramProfile = useCallback(async (userId: string, profile?: TelegramProfileInput) => {
    if (!profile) return;

    const { data: currentProfile } = await supabase
      .from("profiles")
      .select("is_nickname_selected, display_name, avatar_url, telegram_user, telegram_id")
      .eq("id", userId)
      .maybeSingle();

    const patch = buildTelegramProfilePatch(currentProfile, profile);
    if (Object.keys(patch).length === 0) return;

    const { error: updateError } = await supabase.from("profiles").update(patch).eq("id", userId);
    if (updateError) {
      console.error("[Login] Telegram profile sync failed", updateError.message);
    }
  }, []);

  const bindReferral = useCallback(async (code: string | null | undefined) => {
    if (!code) return;

    try {
      await fetch("/api/referrals/bind", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
      });
    } catch (error) {
      console.error("[Login] Failed to bind referral", error);
    }
  }, []);

  useEffect(() => {
    setMounted(true);

    const externalError = mapLoginError(errorCode, errorReason);
    if (externalError) {
      setError(externalError);
      setLoading(false);
      return;
    }

    let isActive = true;
    let widgetTimer: ReturnType<typeof setTimeout> | null = null;

    const init = async () => {
      try {
        const {
          data: { user: existingUser },
        } = await supabase.auth.getUser();

        if (!isActive) return;

        if (existingUser) {
          await bindReferral(referralCode);
          const destination = await resolvePostLoginPath(existingUser.id);
          router.replace(destination);
          return;
        }
      } catch {
        // Keep login flow available if local session read fails.
      }

      const tg = (window as Window & { Telegram?: { WebApp?: TelegramWebApp } }).Telegram?.WebApp;
      if (tg && typeof tg.initData === "string" && tg.initData.length > 0) {
        setTmaDetected(true);

        try {
          const response = await fetch("/api/auth/telegram", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ initData: tg.initData, ref: referralCode }),
          });

          const payload = (await response.json().catch(() => ({}))) as Partial<TelegramAuthResponse> & {
            error?: string;
          };

          if (!response.ok || !payload.email || !payload.password) {
            throw new Error(payload.error || "Сервис Telegram-авторизации временно не ответил");
          }

          const signInResult = await supabase.auth.signInWithPassword({
            email: payload.email,
            password: payload.password,
          });

          if (signInResult.error || !signInResult.data.user) {
            throw signInResult.error || new Error("Не удалось создать сессию");
          }

          await syncTelegramProfile(signInResult.data.user.id, payload.profile);
          await bindReferral(payload.referralCode || referralCode);
          const destination = await resolvePostLoginPath(signInResult.data.user.id);

          if (!isActive) return;
          window.location.replace(destination);
          return;
        } catch (authError: unknown) {
          if (!isActive) return;

          const message = `Ошибка авторизации: ${getErrorMessage(authError, "неизвестная ошибка")}`;
          setError(message);
          setLoading(false);
          notify({
            variant: "error",
            title: "Вход не завершён",
            message,
          });
          return;
        }
      }

      if (!browserLoginAvailable) {
        setLoading(false);
        setError("Браузерный вход здесь выключен. Открой Aura.net внутри Telegram Mini App.");
        return;
      }

      widgetTimer = setTimeout(() => {
        if (!isActive) return;

        if (scriptContainerRef.current && !scriptContainerRef.current.hasChildNodes()) {
          const script = document.createElement("script");
          script.src = "https://telegram.org/js/telegram-widget.js?22";
          script.setAttribute("data-telegram-login", process.env.NEXT_PUBLIC_TELEGRAM_BOT_NAME || "");
          script.setAttribute("data-size", "large");
          script.setAttribute("data-radius", "10");
          script.setAttribute(
            "data-auth-url",
            referralCode ? `/api/auth/telegram?next=/profile&ref=${encodeURIComponent(referralCode)}` : "/api/auth/telegram?next=/profile",
          );
          script.setAttribute("data-request-access", "write");
          script.async = true;
          scriptContainerRef.current.appendChild(script);
        }

        setLoading(false);
      }, 350);
    };

    void init();

    return () => {
      isActive = false;
      if (widgetTimer) {
        clearTimeout(widgetTimer);
      }
    };
  }, [bindReferral, browserLoginAvailable, errorCode, errorReason, notify, referralCode, resolvePostLoginPath, router, syncTelegramProfile]);

  if (!mounted) return null;

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-black relative overflow-hidden font-unbounded">
      <div className="absolute inset-0 grid-bg opacity-30" />

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

          <h2 className="text-2xl font-bold mb-3">{tmaDetected ? "Входим..." : "Добро пожаловать"}</h2>
          <p className="text-muted mb-10 italic text-sm">
            {tmaDetected ? "Подтверждаем вход через Telegram" : "Вход только через подтверждённый Telegram-аккаунт"}
          </p>

          {referralCode ? (
            <div className="mb-6 rounded-2xl border border-neon-green/25 bg-neon-green/[0.08] p-4 text-left">
              <p className="text-[10px] font-black uppercase tracking-[0.18em] text-neon-green/90">Вход по приглашению</p>
              <p className="mt-2 text-[11px] leading-relaxed text-white/72">
                Инвайт уже подхватится автоматически. После первого daily claim и первого живого действия внутри продукта
                активируется welcome bonus для тебя и reward для пригласившего.
              </p>
            </div>
          ) : null}

          <div className="flex flex-col items-center justify-center min-h-[120px] gap-6">
            {error ? (
              <div className="rounded-2xl border border-neon-pink/35 bg-neon-pink/10 p-4 text-left">
                <p className="text-[10px] font-black uppercase tracking-[0.18em] text-neon-pink">Ошибка входа</p>
                <p className="mt-2 text-[11px] leading-relaxed text-white/72">{error}</p>
              </div>
            ) : null}

            {loading && !error ? (
              <div className="flex flex-col items-center gap-4">
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                  className="w-8 h-8 border-4 border-neon-purple border-t-transparent rounded-full"
                />
                <span className="text-muted text-xs uppercase tracking-widest font-bold">
                  {tmaDetected ? "Проверяем Telegram..." : "Запускаем вход..."}
                </span>
              </div>
            ) : null}

            {!tmaDetected && browserLoginAvailable ? (
              <div
                ref={scriptContainerRef}
                className={`transition-all duration-700 transform ${loading ? "opacity-0 scale-95 h-0" : "opacity-100 scale-100"}`}
              />
            ) : null}

            {!browserLoginAvailable && !tmaDetected ? (
              <div className="rounded-2xl border border-amber-300/30 bg-amber-300/10 p-4 text-left">
                <p className="text-[10px] font-black uppercase tracking-[0.18em] text-amber-200">Вход только из Telegram</p>
                <p className="mt-2 text-[11px] leading-relaxed text-white/70">
                  Этот деплой сейчас рассчитан только на Telegram Mini App. Снаружи не показываем сломанный виджет и не ведём в тупик.
                </p>
              </div>
            ) : null}

            <div className="mt-6 text-[10px] text-muted/60 max-w-[260px] leading-relaxed uppercase tracking-tighter font-medium">
              Вход идёт через официальный Telegram SDK и текущую Supabase-сессию.
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
          Вход доступен только через Telegram
        </p>
      </motion.div>
    </div>
  );
}
