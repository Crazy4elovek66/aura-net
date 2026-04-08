"use client";

import { useState } from "react";

interface InviteLoopCardProps {
  inviteCode: string | null;
  webInviteLink: string | null;
  telegramInviteLink: string | null;
  pendingCount: number;
  activatedCount: number;
}

async function copyText(value: string) {
  await navigator.clipboard.writeText(value);
}

export default function InviteLoopCard({
  inviteCode,
  webInviteLink,
  telegramInviteLink,
  pendingCount,
  activatedCount,
}: InviteLoopCardProps) {
  const [copied, setCopied] = useState<string | null>(null);

  const copyLink = async (key: string, value: string | null) => {
    if (!value) return;
    await copyText(value);
    setCopied(key);
    window.setTimeout(() => setCopied((current) => (current === key ? null : current)), 1800);
  };

  return (
    <section className="w-full max-w-xl rounded-3xl border border-white/10 bg-black/30 p-5 backdrop-blur-md">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-[10px] font-black uppercase tracking-[0.2em] text-white/70">Invite Loop</h2>
          <p className="mt-2 text-[11px] text-white/55">Персональный код, безопасная привязка и счётчик активаций.</p>
        </div>
        <div className="text-right">
          <p className="text-[10px] uppercase tracking-[0.1em] text-white/40">Активировано</p>
          <p className="text-sm font-black text-neon-green">{activatedCount}</p>
        </div>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-3">
          <p className="text-[10px] uppercase tracking-[0.1em] text-white/45">Invite code</p>
          <p className="mt-2 text-sm font-black text-white">{inviteCode || "pending"}</p>
          <p className="mt-1 text-[10px] uppercase tracking-[0.08em] text-white/40">Pending: {pendingCount}</p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-3">
          <p className="text-[10px] uppercase tracking-[0.1em] text-white/45">Reward trigger</p>
          <p className="mt-2 text-[11px] leading-relaxed text-white/65">
            Нужны первый daily reward и хотя бы одно реальное social-действие. Это режет самый дешёвый абуз.
          </p>
        </div>
      </div>

      <div className="mt-4 space-y-2">
        <button
          type="button"
          onClick={() => copyLink("web", webInviteLink)}
          disabled={!webInviteLink}
          className="flex w-full items-center justify-between rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-left text-[11px] text-white/75 transition-all hover:border-white/20 disabled:opacity-50"
        >
          <span className="truncate pr-3">{webInviteLink || "Web invite unavailable"}</span>
          <span className="text-[10px] font-black uppercase tracking-[0.1em] text-neon-purple">{copied === "web" ? "copied" : "copy"}</span>
        </button>

        {telegramInviteLink ? (
          <button
            type="button"
            onClick={() => copyLink("telegram", telegramInviteLink)}
            className="flex w-full items-center justify-between rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-left text-[11px] text-white/75 transition-all hover:border-white/20"
          >
            <span className="truncate pr-3">{telegramInviteLink}</span>
            <span className="text-[10px] font-black uppercase tracking-[0.1em] text-neon-green">
              {copied === "telegram" ? "copied" : "copy"}
            </span>
          </button>
        ) : null}
      </div>
    </section>
  );
}
