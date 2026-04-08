"use client";

import Link from "next/link";

type InlineStateTone = "default" | "error" | "warning";

interface InlineStateCardProps {
  eyebrow?: string;
  title: string;
  description?: string;
  tone?: InlineStateTone;
  actionLabel?: string;
  actionHref?: string;
  onAction?: () => void;
}

const TONE_STYLES: Record<InlineStateTone, string> = {
  default: "border-white/10 bg-black/30 text-white",
  error: "border-neon-pink/30 bg-neon-pink/10 text-white",
  warning: "border-amber-300/30 bg-amber-300/10 text-white",
};

export default function InlineStateCard({
  eyebrow,
  title,
  description,
  tone = "default",
  actionLabel,
  actionHref,
  onAction,
}: InlineStateCardProps) {
  return (
    <div className={`w-full rounded-3xl border p-5 backdrop-blur-md ${TONE_STYLES[tone]}`}>
      {eyebrow ? (
        <p className="text-[10px] font-black uppercase tracking-[0.18em] text-white/45">{eyebrow}</p>
      ) : null}
      <h2 className="mt-1 text-sm font-black uppercase tracking-[0.12em] text-white/92">{title}</h2>
      {description ? <p className="mt-2 text-[11px] leading-relaxed text-white/60">{description}</p> : null}

      {actionLabel && actionHref ? (
        <Link
          href={actionHref}
          className="mt-4 inline-flex rounded-2xl border border-white/15 bg-white/[0.04] px-3 py-2 text-[10px] font-black uppercase tracking-[0.14em] text-white transition-colors hover:border-white/30 hover:bg-white/[0.08]"
        >
          {actionLabel}
        </Link>
      ) : null}

      {actionLabel && onAction ? (
        <button
          type="button"
          onClick={onAction}
          className="mt-4 inline-flex rounded-2xl border border-white/15 bg-white/[0.04] px-3 py-2 text-[10px] font-black uppercase tracking-[0.14em] text-white transition-colors hover:border-white/30 hover:bg-white/[0.08]"
        >
          {actionLabel}
        </button>
      ) : null}
    </div>
  );
}
