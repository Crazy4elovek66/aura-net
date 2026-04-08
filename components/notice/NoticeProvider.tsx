"use client";

import { AnimatePresence, motion } from "framer-motion";
import Link from "next/link";
import { createContext, useCallback, useContext, useMemo, useState } from "react";

type NoticeVariant = "info" | "success" | "warning" | "error";

export interface NoticeOptions {
  title: string;
  message?: string;
  variant?: NoticeVariant;
  durationMs?: number;
  actionLabel?: string;
  actionHref?: string;
}

interface NoticeItem extends NoticeOptions {
  id: string;
}

interface NoticeContextValue {
  notify: (options: NoticeOptions) => void;
}

const NoticeContext = createContext<NoticeContextValue | null>(null);

const NOTICE_STYLES: Record<
  NoticeVariant,
  {
    shell: string;
    badge: string;
    glow: string;
  }
> = {
  info: {
    shell: "border-neon-purple/35 bg-black/90 text-white",
    badge: "bg-neon-purple/15 text-neon-purple border-neon-purple/40",
    glow: "shadow-[0_0_40px_rgba(180,74,255,0.18)]",
  },
  success: {
    shell: "border-neon-green/35 bg-black/90 text-white",
    badge: "bg-neon-green/15 text-neon-green border-neon-green/40",
    glow: "shadow-[0_0_40px_rgba(57,255,20,0.16)]",
  },
  warning: {
    shell: "border-amber-300/35 bg-black/90 text-white",
    badge: "bg-amber-300/12 text-amber-200 border-amber-300/35",
    glow: "shadow-[0_0_40px_rgba(252,211,77,0.16)]",
  },
  error: {
    shell: "border-neon-pink/35 bg-black/90 text-white",
    badge: "bg-neon-pink/15 text-neon-pink border-neon-pink/40",
    glow: "shadow-[0_0_40px_rgba(255,45,149,0.18)]",
  },
};

function NoticeViewport({ notices, dismiss }: { notices: NoticeItem[]; dismiss: (id: string) => void }) {
  return (
    <div className="pointer-events-none fixed inset-x-0 top-0 z-[250] flex justify-center px-4 pt-4 sm:justify-end">
      <div className="flex w-full max-w-sm flex-col gap-3">
        <AnimatePresence initial={false}>
          {notices.map((notice) => {
            const variant = notice.variant ?? "info";
            const styles = NOTICE_STYLES[variant];

            return (
              <motion.div
                key={notice.id}
                initial={{ opacity: 0, y: -16, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -10, scale: 0.98 }}
                transition={{ duration: 0.18, ease: "easeOut" }}
                className={`pointer-events-auto rounded-3xl border p-4 backdrop-blur-xl ${styles.shell} ${styles.glow}`}
              >
                <div className="flex items-start gap-3">
                  <div className={`rounded-full border px-2.5 py-1 text-[9px] font-black uppercase tracking-[0.18em] ${styles.badge}`}>
                    {variant}
                  </div>

                  <div className="min-w-0 flex-1">
                    <p className="text-[11px] font-black uppercase tracking-[0.14em] text-white/92">
                      {notice.title}
                    </p>
                    {notice.message ? (
                      <p className="mt-1 text-[11px] leading-relaxed text-white/60">{notice.message}</p>
                    ) : null}

                    {notice.actionHref && notice.actionLabel ? (
                      <Link
                        href={notice.actionHref}
                        onClick={() => dismiss(notice.id)}
                        className="mt-3 inline-flex rounded-2xl border border-white/15 bg-white/6 px-3 py-2 text-[10px] font-black uppercase tracking-[0.14em] text-white transition-colors hover:border-white/30 hover:bg-white/10"
                      >
                        {notice.actionLabel}
                      </Link>
                    ) : null}
                  </div>

                  <button
                    type="button"
                    onClick={() => dismiss(notice.id)}
                    className="rounded-full border border-white/10 px-2 py-1 text-[10px] font-black uppercase tracking-[0.12em] text-white/45 transition-colors hover:text-white"
                    aria-label="Закрыть уведомление"
                  >
                    ×
                  </button>
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </div>
  );
}

export function NoticeProvider({ children }: { children: React.ReactNode }) {
  const [notices, setNotices] = useState<NoticeItem[]>([]);

  const dismiss = useCallback((id: string) => {
    setNotices((current) => current.filter((item) => item.id !== id));
  }, []);

  const notify = useCallback(
    (options: NoticeOptions) => {
      const id =
        typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
          ? crypto.randomUUID()
          : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
      const durationMs = options.durationMs ?? 4500;

      setNotices((current) => [...current, { id, ...options }]);

      if (durationMs > 0) {
        window.setTimeout(() => {
          dismiss(id);
        }, durationMs);
      }
    },
    [dismiss],
  );

  const value = useMemo<NoticeContextValue>(() => ({ notify }), [notify]);

  return (
    <NoticeContext.Provider value={value}>
      {children}
      <NoticeViewport notices={notices} dismiss={dismiss} />
    </NoticeContext.Provider>
  );
}

export function useNotice() {
  const context = useContext(NoticeContext);

  if (!context) {
    throw new Error("useNotice must be used within NoticeProvider");
  }

  return context;
}
