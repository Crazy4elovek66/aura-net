"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import InlineStateCard from "@/components/ux/InlineStateCard";

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
  const [reloadToken, setReloadToken] = useState(0);

  useEffect(() => {
    let isMounted = true;

    const load = async () => {
      setLoading(true);
      setError(null);

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
          setPayload(null);
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
  }, [reloadToken]);

  if (loading) {
    return (
      <InlineStateCard
        eyebrow="Разведка"
        title="Загружаем витрины"
        description="Собираем публичные профили, рост и свежие входы."
      />
    );
  }

  if (error || !payload) {
    return (
      <InlineStateCard
        eyebrow="Разведка"
        title="Раздел временно недоступен"
        description={error || "Не удалось загрузить подборки профилей."}
        tone="error"
        actionLabel="Повторить"
        onAction={() => setReloadToken((current) => current + 1)}
      />
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
      {aroundYou.length > 0 ? (
        <section className="w-full rounded-3xl border border-neon-purple/30 bg-neon-purple/10 backdrop-blur-md p-5">
          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-white/70">Кто рядом с тобой</p>
          <div className="mt-3 space-y-2">
            {aroundYou.map((profile) => renderProfileRow(profile, `Ранг #${profile.rank}`, "text-neon-purple"))}
          </div>
        </section>
      ) : (
        <InlineStateCard
          eyebrow="Разведка"
          title="Соседей по гонке пока нет"
          description="Набор вокруг твоей позиции появится, когда наберётся достаточно активных профилей."
        />
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
            <InlineStateCard title="Пока нет голосов за последние 24 часа" description="Как только начнётся движение, здесь появятся самые обсуждаемые профили." />
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
            <InlineStateCard title="Рост за 24 часа пока пуст" description="Лента заполнится, когда в системе накопится больше заметных изменений ауры." />
          )}
        </div>
      </section>

      <section className="w-full rounded-3xl border border-white/10 bg-black/30 backdrop-blur-md p-5">
        <p className="text-[10px] font-black uppercase tracking-[0.18em] text-white/70">Новые профили</p>
        <div className="mt-3 space-y-2">
          {newProfiles.length ? (
            newProfiles.map((profile) =>
              renderProfileRow(profile, `Создан: ${formatShortDate(profile.createdAt)} UTC+0`, "text-white/90"),
            )
          ) : (
            <InlineStateCard title="Новых профилей пока нет" description="Когда пользователи начнут заходить, здесь появится свежий поток регистраций." />
          )}
        </div>
      </section>

      <p className="text-[10px] uppercase tracking-[0.08em] text-white/40">Обновлено: {formatShortDate(payload.generatedAt)} UTC+0</p>
    </div>
  );
}
