"use client";

import React, { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { getAuraTier, formatAuraPoints } from "@/lib/aura";
import { createClient } from "@/lib/supabase/client";
import { isResonanceSpecialCard } from "@/lib/special-card";
import { useNotice } from "@/components/notice/NoticeProvider";
import BurnLog from "./BurnLog";
import UniversalCreatorCard from "./UniversalCreatorCard";

interface AuraCardProps {
  username: string;
  displayName: string;
  avatarUrl: string | null;
  auraPoints: number;
  totalVotesUp: number;
  totalVotesDown: number;
  profileId?: string;
  status?: string;
  specialCard?: string | null;
  canManageSpecialCard?: boolean;
  spotlightUntil?: string | null;
  decayShieldUntil?: string | null;
  cardAccent?: string | null;
  cardAccentUntil?: string | null;
  hasVoted?: boolean;
}

const supabase = createClient();

function isActiveUntil(iso: string | null | undefined): boolean {
  return Boolean(iso && new Date(iso).getTime() > Date.now());
}

function formatEffectUntil(iso: string | null | undefined): string {
  if (!iso) return "-";
  return new Date(iso).toLocaleString("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function getCardAccentLabel(value: string | null | undefined): string {
  switch (value) {
    case "NEON_EDGE":
      return "Неоновая грань";
    case "GOLD_PULSE":
      return "Золотой импульс";
    case "FROST_RING":
      return "Ледяной контур";
    default:
      return "Акцент";
  }
}

export default function AuraCard({
  username,
  displayName,
  avatarUrl,
  auraPoints: initialAura,
  totalVotesUp: initialUp,
  totalVotesDown: initialDown,
  profileId,
  status: initialStatus,
  specialCard: initialSpecialCard = null,
  spotlightUntil = null,
  decayShieldUntil = null,
  cardAccent = null,
  cardAccentUntil = null,
  hasVoted: initialHasVoted = false,
  canManageSpecialCard = false,
  isOwner = false,
}: AuraCardProps & { isOwner?: boolean }) {
  const [auraPoints, setAuraPoints] = useState(initialAura);
  const [upVotes, setUpVotes] = useState(initialUp);
  const [downVotes, setDownVotes] = useState(initialDown);
  const [votePendingType, setVotePendingType] = useState<"up" | "down" | null>(null);
  const [hasVoted, setHasVoted] = useState(initialHasVoted);
  const [isEditing, setIsEditing] = useState(false);
  const [currentDisplayName, setCurrentDisplayName] = useState(displayName);
  const [editValue, setEditValue] = useState(displayName);
  const [isEditingStatus, setIsEditingStatus] = useState(false);
  const [statusValue, setStatusValue] = useState(initialStatus || "");
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState(initialStatus);
  const [specialCard, setSpecialCard] = useState<string | null>(initialSpecialCard);
  const [showBurnLog, setShowBurnLog] = useState(false);
  const isEditingRef = useRef(false);
  const { notify } = useNotice();
  const tier = getAuraTier(auraPoints);

  useEffect(() => {
    isEditingRef.current = isEditing;
  }, [isEditing]);

  useEffect(() => {
    setAuraPoints(initialAura);
  }, [initialAura]);

  useEffect(() => {
    setUpVotes(initialUp);
  }, [initialUp]);

  useEffect(() => {
    setDownVotes(initialDown);
  }, [initialDown]);

  useEffect(() => {
    setHasVoted(initialHasVoted);
  }, [initialHasVoted]);

  useEffect(() => {
    setStatus(initialStatus);
    if (!isEditingStatus) {
      setStatusValue(initialStatus || "");
    }
  }, [initialStatus, isEditingStatus]);

  useEffect(() => {
    setSpecialCard(initialSpecialCard);
  }, [initialSpecialCard]);

  useEffect(() => {
    if (!isEditing) {
      setCurrentDisplayName(displayName);
      setEditValue(displayName);
    }
  }, [displayName, isEditing]);

  useEffect(() => {
    if (!profileId) return;

    const channel = supabase
      .channel(`card-${profileId}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "profiles", filter: `id=eq.${profileId}` },
        (payload) => {
          setAuraPoints(payload.new.aura_points);
          setStatus(payload.new.status);
          setSpecialCard(payload.new.special_card);
          if (!isEditingRef.current) {
            setCurrentDisplayName(payload.new.display_name);
            setEditValue(payload.new.display_name);
          }
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [profileId]);

  const handleUpdateName = async () => {
    if (!profileId || loading || !editValue.trim()) return;

    setLoading(true);
    const nextDisplayName = editValue.trim();
    const { error } = await supabase.from("profiles").update({ display_name: nextDisplayName }).eq("id", profileId);

    if (!error) {
      setCurrentDisplayName(nextDisplayName);
      setIsEditing(false);
      setLoading(false);
      return;
    }

    notify({
      variant: "error",
      title: "Имя не обновлено",
      message: "Не удалось сохранить имя профиля.",
    });
    setLoading(false);
  };

  const handleUpdateStatus = async () => {
    if (!profileId || loading) return;

    setLoading(true);
    const nextStatus = statusValue.trim();
    const { error } = await supabase.from("profiles").update({ status: nextStatus }).eq("id", profileId);

    if (!error) {
      setStatus(nextStatus);
      setIsEditingStatus(false);
      setLoading(false);
      return;
    }

    notify({
      variant: "error",
      title: "Статус не обновлён",
      message: "Не удалось сохранить статус.",
    });
    setLoading(false);
  };

  const isDuplicateVoteError = (message: string) => {
    const normalized = message.toLowerCase();
    return normalized.includes("уже голосовал") || normalized.includes("already voted");
  };

  const applyConfirmedVote = (type: "up" | "down", rawAuraChange: unknown) => {
    const fallbackAuraChange = type === "up" ? 10 : -10;
    const parsedAuraChange = typeof rawAuraChange === "number" ? rawAuraChange : Number(rawAuraChange);
    const confirmedAuraChange = Number.isFinite(parsedAuraChange) ? parsedAuraChange : fallbackAuraChange;

    setAuraPoints((prev) => Math.max(0, prev + confirmedAuraChange));

    if (type === "up") {
      setUpVotes((prev) => prev + 1);
    } else {
      setDownVotes((prev) => prev + 1);
    }

    setHasVoted(true);
  };

  const handleVote = async (type: "up" | "down") => {
    if (votePendingType || hasVoted || loading) return;

    setVotePendingType(type);
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      let currentUser = session?.user ?? null;
      if (!currentUser) {
        const {
          data: { user },
        } = await supabase.auth.getUser();
        currentUser = user;
      }

      const isCheckPage = typeof window !== "undefined" && window.location.pathname.includes("/check/");

      if (!profileId) {
        notify(
          currentUser
            ? {
                variant: "info",
                title: "Это демо-карточка",
                message: "Голосование доступно только на реальных публичных профилях.",
                actionLabel: "Открыть профиль",
                actionHref: "/profile",
              }
            : {
                variant: "warning",
                title: "Нужен вход",
                message: "Для голосования войди через Telegram.",
                actionLabel: "Войти",
                actionHref: "/login",
              },
        );
        return;
      }

      if (!currentUser) {
        if (!isCheckPage) {
          notify({
            variant: "warning",
            title: "Нужен вход",
            message: "С этой страницы можно голосовать только из авторизованного аккаунта.",
            actionLabel: "Войти",
            actionHref: "/login",
          });
          return;
        }

        const { error: authError } = await supabase.auth.signInAnonymously();
        if (authError) throw authError;

        const voteResponse = await fetch("/api/vote", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ targetId: profileId, type, isAnonymous: true }),
        });

        const votePayload = await voteResponse.json().catch(() => ({}));
        if (!voteResponse.ok) {
          const errorMessage = String(votePayload.error || "Не удалось отправить голос");
          if (isDuplicateVoteError(errorMessage)) {
            setHasVoted(true);
          }
          notify({
            variant: "error",
            title: "Голос не отправлен",
            message: errorMessage,
          });
          return;
        }

        applyConfirmedVote(type, votePayload.newAuraChange);
        notify({
          variant: "success",
          title: "Анонимный голос принят",
          message: "Чтобы сохранить прогресс и открыть полный профиль, войди через Telegram.",
          actionLabel: "Войти",
          actionHref: "/login",
        });
        return;
      }

      const response = await fetch("/api/vote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetId: profileId, type }),
      });

      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        const errorMessage = String(payload.error || "Не удалось отправить голос");
        if (isDuplicateVoteError(errorMessage)) {
          setHasVoted(true);
        }
        notify({
          variant: "error",
          title: "Голос не отправлен",
          message: errorMessage,
        });
        return;
      }

      applyConfirmedVote(type, payload.newAuraChange);
    } catch (error) {
      console.error(error);
      notify({
        variant: "error",
        title: "Сетевая ошибка",
        message: "Не удалось отправить голос. Повтори попытку.",
      });
    } finally {
      setVotePendingType(null);
    }
  };

  const handleResonanceStatus = async (mode: "assign" | "remove") => {
    if (!profileId || loading) return;

    setLoading(true);
    try {
      const response = await fetch("/api/admin/special-card", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ profileId, mode }),
      });

      const payload = await response.json().catch(() => ({}));

      if (!response.ok) {
        notify({
          variant: "error",
          title: "Спец-статус не обновлён",
          message: String(payload.error || "Не удалось обновить спец-статус"),
        });
        return;
      }

      setSpecialCard(payload.specialCard ?? null);
      notify({
        variant: "success",
        title: mode === "assign" ? "Резонанс включён" : "Резонанс снят",
      });
    } catch {
      notify({
        variant: "error",
        title: "Ошибка сети",
        message: "Не удалось обновить спец-статус.",
      });
    } finally {
      setLoading(false);
    }
  };

  const nextTierPoints = tier.id === "NPC" ? 501 : tier.id === "HERO" ? 2001 : tier.id === "THAT_ONE" ? 5001 : null;
  const prevTierPoints = tier.id === "NPC" ? 0 : tier.id === "HERO" ? 501 : tier.id === "THAT_ONE" ? 2001 : 5001;

  let progressToNext = 100;
  if (nextTierPoints) {
    progressToNext = ((auraPoints - prevTierPoints) / (nextTierPoints - prevTierPoints)) * 100;
  }

  const displayAvatarUrl = avatarUrl?.startsWith("http")
    ? `/api/proxy/image?url=${encodeURIComponent(avatarUrl)}`
    : avatarUrl;

  const universalData = {
    tier: tier.labelRu,
    displayName: currentDisplayName,
    username,
    avatarUrl: displayAvatarUrl,
    verdict:
      status ||
      (tier.id === "SIGMA"
        ? "Легенда зашла в чат."
        : tier.id === "THAT_ONE"
          ? "Тот самый, о ком все говорят."
          : tier.id === "HERO"
            ? "Герой нашего времени."
            : "НПС не имеют права голоса."),
    auraPoints: formatAuraPoints(auraPoints),
    auraPlus: upVotes,
    auraMinus: downVotes,
    progress: Math.round(Math.max(0, Math.min(100, progressToNext))),
  };

  const isSpecialAdmin = username === "id1";
  const isResonance = !isSpecialAdmin && isResonanceSpecialCard(specialCard);
  const tierId = isSpecialAdmin ? "ADMIN" : isResonance ? "RESONANCE" : (tier.id as "NPC" | "HERO" | "THAT_ONE" | "SIGMA");
  const spotlightActive = isActiveUntil(spotlightUntil);
  const decayShieldActive = isActiveUntil(decayShieldUntil);
  const cardAccentActive = isActiveUntil(cardAccentUntil);
  const activeCardAccent = cardAccentActive ? cardAccent : null;

  return (
    <div id="aura-card-element" className="relative group w-fit mx-auto">
      <div className="relative">
        <UniversalCreatorCard
          data={universalData}
          tier={tierId}
          isOwner={isOwner}
          isEditing={isEditing}
          editValue={editValue}
          onNameEditClick={() => isOwner && setIsEditing(true)}
          onEditChange={(e: React.ChangeEvent<HTMLInputElement>) => setEditValue(e.target.value)}
          onEditBlur={handleUpdateName}
          onEditKeyDown={(e: React.KeyboardEvent<HTMLInputElement>) => e.key === "Enter" && handleUpdateName()}
          isEditingStatus={isEditingStatus}
          statusValue={statusValue}
          onStatusEditClick={() => isOwner && auraPoints > 500 && setIsEditingStatus(true)}
          onStatusChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setStatusValue(e.target.value)}
          onStatusBlur={handleUpdateStatus}
          onStatusKeyDown={(e: React.KeyboardEvent<HTMLTextAreaElement>) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              handleUpdateStatus();
            }
          }}
          statusClassName={isSpecialAdmin ? "architect-text-glow" : isResonance ? "resonance-text-glow" : ""}
          onAuraPlus={() => handleVote("up")}
          onAuraMinus={() => handleVote("down")}
          votePendingType={votePendingType}
          hasVoted={hasVoted}
        >
          <div className="absolute inset-0 z-0 pointer-events-none">
            {tier.id === "SIGMA" && (
              <>
                <div className="absolute inset-0 bg-gradient-to-br from-amber-500/20 via-black to-yellow-900/10" />
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(251,191,36,0.08)_0%,transparent_70%)]" />
                <div className="absolute inset-0 overflow-hidden">
                  <motion.div
                    initial={{ left: "-100%" }}
                    animate={{ left: "200%" }}
                    transition={{ duration: 4, repeat: Infinity, repeatDelay: 6, ease: "easeInOut" }}
                    className="absolute top-0 bottom-0 w-[50%] skew-x-[-25deg] bg-gradient-to-r from-transparent via-amber-400/20 to-transparent"
                    style={{ willChange: "transform" }}
                  />
                </div>
              </>
            )}
            {tier.id === "THAT_ONE" && <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/15 via-transparent to-indigo-500/5" />}
            {tier.id === "HERO" && <div className="absolute inset-0 bg-gradient-to-br from-purple-500/15 via-transparent to-purple-500/5" />}
            {isResonance && (
              <>
                <div className="absolute inset-0 bg-gradient-to-br from-cyan-400/14 via-slate-900/20 to-teal-400/10" />
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_10%,rgba(34,211,238,0.14)_0%,transparent_45%)]" />
                <div className="absolute inset-0 overflow-hidden">
                  <motion.div
                    initial={{ left: "-120%" }}
                    animate={{ left: "180%" }}
                    transition={{ duration: 6, repeat: Infinity, repeatDelay: 4, ease: "easeInOut" }}
                    className="absolute top-0 bottom-0 w-[40%] skew-x-[-18deg] bg-gradient-to-r from-transparent via-cyan-300/15 to-transparent"
                    style={{ willChange: "transform" }}
                  />
                </div>
              </>
            )}
            {tier.id === "NPC" && <div className="absolute inset-0 bg-white/[0.03]" />}
            {isSpecialAdmin && <Slot00Background />}
          </div>
        </UniversalCreatorCard>

        {activeCardAccent === "NEON_EDGE" && (
          <div className="pointer-events-none absolute inset-[0.35rem] rounded-[3.3rem] border border-fuchsia-300/80 shadow-[0_0_25px_rgba(232,121,249,0.55)]" />
        )}
        {activeCardAccent === "GOLD_PULSE" && (
          <div className="pointer-events-none absolute inset-[0.35rem] rounded-[3.3rem] border border-amber-300/80 shadow-[0_0_28px_rgba(252,211,77,0.55)] animate-pulse" />
        )}
        {activeCardAccent === "FROST_RING" && (
          <div className="pointer-events-none absolute inset-[0.35rem] rounded-[3.3rem] border border-cyan-300/80 shadow-[0_0_24px_rgba(103,232,249,0.55)]" />
        )}
      </div>

      {(spotlightActive || decayShieldActive || cardAccentActive) && (
        <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
          {spotlightActive && (
            <span className="rounded-full border border-neon-pink/40 bg-neon-pink/10 px-2.5 py-1 text-[9px] font-black uppercase tracking-[0.12em] text-neon-pink">
              Фокус до {formatEffectUntil(spotlightUntil)} UTC+0
            </span>
          )}
          {decayShieldActive && (
            <span className="rounded-full border border-neon-green/40 bg-neon-green/10 px-2.5 py-1 text-[9px] font-black uppercase tracking-[0.12em] text-neon-green">
              Щит до {formatEffectUntil(decayShieldUntil)} UTC+0
            </span>
          )}
          {cardAccentActive && (
            <span className="rounded-full border border-white/20 bg-white/10 px-2.5 py-1 text-[9px] font-black uppercase tracking-[0.12em] text-white/85">
              {getCardAccentLabel(cardAccent)} до {formatEffectUntil(cardAccentUntil)} UTC+0
            </span>
          )}
        </div>
      )}

      {canManageSpecialCard && profileId && !isSpecialAdmin && (
        <div className="mt-4 flex justify-center">
          <button
            type="button"
            onClick={() => handleResonanceStatus(isResonance ? "remove" : "assign")}
            disabled={loading}
            className={`px-4 py-2 rounded-xl border text-[10px] font-black uppercase tracking-[0.2em] transition-all ${
              isResonance
                ? "border-cyan-300/50 text-cyan-100 bg-cyan-300/10 hover:bg-cyan-300/20"
                : "border-white/20 text-white/70 bg-white/5 hover:bg-white/10"
            } ${loading ? "opacity-50 cursor-not-allowed" : ""}`}
          >
            {isResonance ? "Снять Резонанс" : "Выдать Резонанс"}
          </button>
        </div>
      )}

      <AnimatePresence>
        {showBurnLog && isOwner && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="absolute inset-0 z-50 bg-black/95 backdrop-blur-xl p-6 overflow-y-auto rounded-[3.5rem]"
          >
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xs font-black uppercase text-neon-pink">Список Сжигателей</h3>
              <button type="button" onClick={() => setShowBurnLog(false)} className="text-white/40 hover:text-white">
                ×
              </button>
            </div>
            {tier.id === "THAT_ONE" || tier.id === "SIGMA" || isSpecialAdmin ? (
              <BurnLog profileId={profileId || ""} />
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-center">
                <p className="text-[10px] font-black uppercase text-white/30 tracking-widest">Доступно только элите</p>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function Slot00Background() {
  const codeFragments = ["AURA", "NET", "ROOT", "SYS", "01", "EXEC", "INIT", "NODE", "X8F", "0X0", "SEED", "CORE", "DATA"];

  return (
    <div className="absolute inset-0 opacity-80 pointer-events-none overflow-hidden [mask-image:linear-gradient(to_bottom,transparent,black_15%,black_85%,transparent)]">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(168,85,247,0.2)_0%,transparent_70%)]" />
      <div className="relative w-full h-full">
        {Array.from({ length: 12 }).map((_, i) => (
          <motion.div
            key={i}
            initial={{ y: -400 }}
            animate={{ y: 1200 }}
            transition={{ duration: 25 + (i % 5) * 5, repeat: Infinity, ease: "linear", delay: i * 1.5 }}
            className="absolute text-[10px] sm:text-[12px] font-mono font-bold tracking-[0.3em] text-purple-300/40 blur-[1px] [text-shadow:0_0_10px_rgba(168,85,247,0.8)] [writing-mode:vertical-rl]"
            style={{ left: `${4 + i * 8}%`, willChange: "transform" }}
          >
            {codeFragments[i % codeFragments.length]} · MATRIX · ESTABLISHED ··· {codeFragments[(i + 3) % codeFragments.length]}
          </motion.div>
        ))}
      </div>
    </div>
  );
}
