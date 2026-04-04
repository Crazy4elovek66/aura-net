"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

interface DiscoverBase {
  id: string;
  username: string;
  displayName: string;
  auraPoints: number;
}

interface AroundProfile extends DiscoverBase {
  rank: number;
}

interface HypeProfile extends DiscoverBase {
  votesTotal: number;
  votesUp: number;
  votesDown: number;
  netVotes: number;
}

interface GrowthProfile extends DiscoverBase {
  rank: number;
  growthPoints: number;
}

interface NewProfile extends DiscoverBase {
  createdAt: string;
}

interface DiscoverPayload {
  generatedAt: string;
  sections: {
    aroundYou: AroundProfile[];
    hypeProfiles: HypeProfile[];
    growth24h: GrowthProfile[];
    newProfiles: NewProfile[];
  };
}

function formatShortDate(iso: string) {
  if (!iso) return "-";
  return new Date(iso).toLocaleString("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function DiscoverHub() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [payload, setPayload] = useState<DiscoverPayload | null>(null);

  useEffect(() => {
    let isMounted = true;

    const load = async () => {
      try {
        const response = await fetch("/api/discover", { cache: "no-store" });
        const data = (await response.json()) as DiscoverPayload & { error?: string };

        if (!response.ok) {
          throw new Error(data.error || "Не удалось загрузить раздел «Разведка»");
        }

        if (isMounted) {
          setPayload(data);
        }
      } catch (loadError) {
        if (isMounted) {
          setError(loadError instanceof Error ? loadError.message : "Ошибка загрузки");
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    void load();

    return () => {
      isMounted = false;
    };
  }, []);

  if (loading) {
    return (
      <div className="w-full rounded-3xl border border-white/10 bg-black/30 backdrop-blur-md p-5 animate-pulse">
        <div className="h-5 w-52 rounded bg-white/10" />
        <div className="mt-4 h-24 rounded-2xl bg-white/10" />
      </div>
    );
  }

  if (error || !payload) {
    return (
      <div className="w-full rounded-3xl border border-neon-pink/30 bg-neon-pink/10 p-5">
        <p className="text-xs font-black uppercase tracking-[0.12em] text-neon-pink">{error || "Разведка недоступна"}</p>
      </div>
    );
  }

  const { aroundYou, hypeProfiles, growth24h, newProfiles } = payload.sections;

  const renderProfileRow = (
    profile: DiscoverBase,
    note: string,
    accentClass: string,
    returnTo: "discover" = "discover",
  ) => (
    <Link
      key={`${profile.id}-${note}`}
      href={`/check/${profile.username}?returnTo=${returnTo}`}
      className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/[0.02] px-3 py-2 hover:border-neon-purple/40 transition-colors"
    >
      <div className="min-w-0 pr-3">
        <p className="truncate text-sm text-white/90">{profile.displayName}</p>
        <p className="text-[10px] uppercase tracking-[0.08em] text-white/45">{note}</p>
      </div>
      <p className={`text-sm font-black ${accentClass}`}>{profile.auraPoints}</p>
    </Link>
  );

  return (
    <div className="w-full space-y-5">
      {aroundYou.length > 0 && (
        <section className="w-full rounded-3xl border border-neon-purple/30 bg-neon-purple/10 backdrop-blur-md p-5">
          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-white/70">Кто рядом с тобой</p>
          <div className="mt-3 space-y-2">
            {aroundYou.map((profile) =>
              renderProfileRow(profile, `Ранг #${profile.rank}`, "text-neon-purple"),
            )}
          </div>
        </section>
      )}

      <section className="w-full rounded-3xl border border-white/10 bg-black/30 backdrop-blur-md p-5">
        <p className="text-[10px] font-black uppercase tracking-[0.18em] text-white/70">Кто на хайпе (24ч)</p>
        <div className="mt-3 space-y-2">
          {hypeProfiles.length ? (
            hypeProfiles.map((profile) =>
              renderProfileRow(
                profile,
                `${profile.votesTotal} голосов, net ${profile.netVotes >= 0 ? `+${profile.netVotes}` : profile.netVotes}`,
                "text-neon-pink",
              ),
            )
          ) : (
            <p className="rounded-2xl border border-white/10 bg-white/[0.02] px-3 py-2 text-[11px] text-white/60">Пока нет голосов за последние 24 часа.</p>
          )}
        </div>
      </section>

      <section className="w-full rounded-3xl border border-white/10 bg-black/30 backdrop-blur-md p-5">
        <p className="text-[10px] font-black uppercase tracking-[0.18em] text-white/70">Рост за 24 часа</p>
        <div className="mt-3 space-y-2">
          {growth24h.length ? (
            growth24h.map((profile) =>
              renderProfileRow(profile, `#${profile.rank} · +${profile.growthPoints} ауры`, "text-neon-green"),
            )
          ) : (
            <p className="rounded-2xl border border-white/10 bg-white/[0.02] px-3 py-2 text-[11px] text-white/60">Пока нет заметного роста за 24 часа.</p>
          )}
        </div>
      </section>

      <section className="w-full rounded-3xl border border-white/10 bg-black/30 backdrop-blur-md p-5">
        <p className="text-[10px] font-black uppercase tracking-[0.18em] text-white/70">Новые профили</p>
        <div className="mt-3 space-y-2">
          {newProfiles.map((profile) =>
            renderProfileRow(profile, `Создан: ${formatShortDate(profile.createdAt)} UTC+0`, "text-white/90"),
          )}
        </div>
      </section>

      <p className="text-[10px] uppercase tracking-[0.08em] text-white/40">Обновлено: {formatShortDate(payload.generatedAt)} UTC+0</p>
    </div>
  );
}
