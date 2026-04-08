"use client";

import Link from "next/link";

interface FeedbackPageProps {
  code?: string;
  title: string;
  description: string;
  primaryLabel: string;
  primaryHref?: string;
  onPrimaryClick?: () => void;
  secondaryLabel?: string;
  secondaryHref?: string;
}

export default function FeedbackPage({
  code,
  title,
  description,
  primaryLabel,
  primaryHref,
  onPrimaryClick,
  secondaryLabel,
  secondaryHref,
}: FeedbackPageProps) {
  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-black px-4 py-12 text-white">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(180,74,255,0.18),transparent_45%),radial-gradient(circle_at_bottom_right,rgba(255,45,149,0.12),transparent_38%)]" />
      <div className="absolute inset-0 bg-grid opacity-30" />

      <div className="relative z-10 w-full max-w-xl rounded-[2rem] border border-white/10 bg-black/60 p-8 text-center backdrop-blur-xl">
        {code ? (
          <p className="text-[10px] font-black uppercase tracking-[0.3em] text-neon-purple">{code}</p>
        ) : null}
        <h1 className="mt-3 text-3xl font-black uppercase tracking-tight text-white">{title}</h1>
        <p className="mt-4 text-sm leading-relaxed text-white/60">{description}</p>

        <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
          {primaryHref ? (
            <Link
              href={primaryHref}
              className="inline-flex min-w-44 justify-center rounded-2xl border border-neon-purple/35 bg-neon-purple/12 px-5 py-3 text-[11px] font-black uppercase tracking-[0.16em] text-neon-purple transition-colors hover:bg-neon-purple/18"
            >
              {primaryLabel}
            </Link>
          ) : (
            <button
              type="button"
              onClick={onPrimaryClick}
              className="inline-flex min-w-44 justify-center rounded-2xl border border-neon-purple/35 bg-neon-purple/12 px-5 py-3 text-[11px] font-black uppercase tracking-[0.16em] text-neon-purple transition-colors hover:bg-neon-purple/18"
            >
              {primaryLabel}
            </button>
          )}

          {secondaryHref && secondaryLabel ? (
            <Link
              href={secondaryHref}
              className="inline-flex min-w-44 justify-center rounded-2xl border border-white/15 bg-white/[0.03] px-5 py-3 text-[11px] font-black uppercase tracking-[0.16em] text-white/78 transition-colors hover:border-white/30 hover:bg-white/[0.06]"
            >
              {secondaryLabel}
            </Link>
          ) : null}
        </div>
      </div>
    </div>
  );
}
