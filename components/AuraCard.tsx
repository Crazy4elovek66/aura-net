"use client";

import { motion, AnimatePresence } from "framer-motion";
import { getAuraTier, formatAuraPoints } from "@/lib/aura";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { isResonanceSpecialCard } from "@/lib/special-card";
import { useRouter } from "next/navigation";
import BurnLog from "./BurnLog";
import UniversalCreatorCard from "./UniversalCreatorCard";
import React from "react";

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
  isBoosted?: boolean;
}

const supabase = createClient();

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
  canManageSpecialCard = false,
  isOwner = false,
}: AuraCardProps & { isOwner?: boolean }) {
  const [auraPoints, setAuraPoints] = useState(initialAura);
  const upVotes = initialUp;
  const downVotes = initialDown;
  const [isEditing, setIsEditing] = useState(false);
  const [currentDisplayName, setCurrentDisplayName] = useState(displayName);
  const [editValue, setEditValue] = useState(displayName);
  const [isEditingStatus, setIsEditingStatus] = useState(false);
  const [statusValue, setStatusValue] = useState(initialStatus || "");
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState(initialStatus);
  const [specialCard, setSpecialCard] = useState<string | null>(initialSpecialCard);
  const [showBurnLog, setShowBurnLog] = useState(false);
  const [showAuthToast, setShowAuthToast] = useState(false);
  const [toastVariant, setToastVariant] = useState<"auth" | "demo">("auth");
  const [toastTimer, setToastTimer] = useState<NodeJS.Timeout | null>(null);

  const router = useRouter();
  const tier = getAuraTier(auraPoints);

  // Реал-тайм обновления
  useEffect(() => {
    if (!profileId) return;

    const channel = supabase
      .channel(`card-${profileId}`)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "profiles", filter: `id=eq.${profileId}` },
        (payload) => {
          setAuraPoints(payload.new.aura_points);
          setStatus(payload.new.status);
          setSpecialCard(payload.new.special_card);
          if (!isEditing) {
            setCurrentDisplayName(payload.new.display_name);
            setEditValue(payload.new.display_name);
          }
        })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [profileId, isEditing]);

  const handleUpdateName = async () => {
    if (!profileId || loading || !editValue.trim()) return;
    setLoading(true);
    const { error } = await supabase.from("profiles").update({ display_name: editValue.trim() }).eq("id", profileId);
    if (!error) {
      setCurrentDisplayName(editValue.trim());
      setIsEditing(false);
    }
    setLoading(false);
  };

  const handleUpdateStatus = async () => {
    if (!profileId || loading) return;
    setLoading(true);
    const { error } = await supabase
      .from("profiles")
      .update({ status: statusValue.trim() })
      .eq("id", profileId);
    if (!error) {
      setStatus(statusValue.trim());
      setIsEditingStatus(false);
    }
    setLoading(false);
  };

  const handleVote = async (type: 'up' | 'down') => {
    if (loading) return;
    setLoading(true);
    try {
      const { data: { user: currentUser } } = await supabase.auth.getUser();
      const isCheckPage = typeof window !== 'undefined' && window.location.pathname.includes('/check/');

      if (!profileId) {
        if (!currentUser) {
          triggerAuthToast();
        } else {
          triggerDemoToast();
        }
        return;
      }

      if (!currentUser) {
        if (isCheckPage) {
          // Анонимный вход + голос (для конверсии)
          const { error: authError } = await supabase.auth.signInAnonymously();
          if (authError) throw authError;
          
          const voteResponse = await fetch("/api/vote", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ targetId: profileId, type, isAnonymous: true }),
          });

          const votePayload = await voteResponse.json().catch(() => ({}));

          if (!voteResponse.ok) {
            alert(votePayload.error || "Не удалось отправить голос");
            return;
          }

          // Сразу после голоса — "Притормози ковбой" (призыв к регистрации)
          triggerAuthToast();
          router.refresh();
        } else {
          // На главной — просто блокируем
          triggerAuthToast();
        }
      } else {
        // Залогинен — обычный голос
        const res = await fetch("/api/vote", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ targetId: profileId, type }),
        });

        const payload = await res.json().catch(() => ({}));
        if (res.ok) {
          router.refresh();
        } else {
          alert(payload.error || "Не удалось отправить голос");
        }
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  // Trigger toast with robust timer reset
  const triggerAuthToast = () => {
    if (toastTimer) clearTimeout(toastTimer);
    setToastVariant("auth");
    setShowAuthToast(true);
    const timer = setTimeout(() => setShowAuthToast(false), 3000);
    setToastTimer(timer);
  };

  const triggerDemoToast = () => {
    if (toastTimer) clearTimeout(toastTimer);
    setToastVariant("demo");
    setShowAuthToast(true);
    const timer = setTimeout(() => setShowAuthToast(false), 3000);
    setToastTimer(timer);
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
        alert(payload.error || "Не удалось обновить спец-статус");
        return;
      }

      setSpecialCard(payload.specialCard ?? null);
      router.refresh();
    } catch {
      alert("Ошибка сети");
    } finally {
      setLoading(false);
    }
  };

  // Расчет прогресса до следующего уровня
  const nextTierPoints = tier.id === 'NPC' ? 501 : tier.id === 'HERO' ? 2001 : tier.id === 'THAT_ONE' ? 5001 : null;
  const prevTierPoints = tier.id === 'NPC' ? 0 : tier.id === 'HERO' ? 501 : tier.id === 'THAT_ONE' ? 2001 : 5001;
  
  let progressToNext = 100;
  if (nextTierPoints) {
    progressToNext = ((auraPoints - prevTierPoints) / (nextTierPoints - prevTierPoints)) * 100;
  }

  // Формируем URL аватарки через прокси для CORS (только для внешних ссылок)
  const displayAvatarUrl = avatarUrl?.startsWith('http')
    ? `/api/proxy/image?url=${encodeURIComponent(avatarUrl)}`
    : avatarUrl;

  // --- UNIVERSAL RENDERING ---
  const universalData = {
    tier: tier.labelRu,
    displayName: currentDisplayName,
    username: username,
    avatarUrl: displayAvatarUrl,
    verdict: status || (tier.id === 'SIGMA' ? "Легенда зашла в чат." : tier.id === 'THAT_ONE' ? "Тот самый, о ком все говорят." : tier.id === 'HERO' ? "Герой нашего времени." : "НПС не имеют права голоса."),
    auraPoints: formatAuraPoints(auraPoints),
    auraPlus: upVotes,
    auraMinus: downVotes,
    progress: Math.round(Math.max(0, Math.min(100, progressToNext)))
  };

  const isSpecialAdmin = username === "id1";
  const isResonance = !isSpecialAdmin && isResonanceSpecialCard(specialCard);
  const tierId = isSpecialAdmin
    ? "ADMIN"
    : isResonance
      ? "RESONANCE"
      : (tier.id as "NPC" | "HERO" | "THAT_ONE" | "SIGMA");

  return (
    <div id="aura-card-element" className="relative group w-fit mx-auto">
       <UniversalCreatorCard
          data={universalData}
          tier={tierId}
          isOwner={isOwner}
          isEditing={isEditing}
          editValue={editValue}
          onNameEditClick={() => isOwner && setIsEditing(true)}
          onEditChange={(e: React.ChangeEvent<HTMLInputElement>) => setEditValue(e.target.value)}
          onEditBlur={handleUpdateName}
          onEditKeyDown={(e: React.KeyboardEvent<HTMLInputElement>) => e.key === 'Enter' && handleUpdateName()}
          
          isEditingStatus={isEditingStatus}
          statusValue={statusValue}
          onStatusEditClick={() => isOwner && auraPoints > 500 && setIsEditingStatus(true)}
          onStatusChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setStatusValue(e.target.value)}
          onStatusBlur={handleUpdateStatus}
          onStatusKeyDown={(e: React.KeyboardEvent<HTMLTextAreaElement>) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              handleUpdateStatus();
            }
          }}
          statusClassName={isSpecialAdmin ? 'architect-text-glow' : isResonance ? 'resonance-text-glow' : ''}
          onAuraPlus={() => handleVote('up')}
          onAuraMinus={() => handleVote('down')}
       >
          {/* TIER-SPECIFIC BACKGROUNDS (PRESERVING STYLE) */}
          <div className="absolute inset-0 z-0 pointer-events-none">
             {tier.id === 'SIGMA' && (
                <>
                  <div className="absolute inset-0 bg-gradient-to-br from-amber-500/20 via-black to-yellow-900/10" />
                  <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(251,191,36,0.08)_0%,transparent_70%)]" />
                  {/* Golden Sweep Effect */}
                  <div className="absolute inset-0 overflow-hidden">
                    <motion.div 
                      initial={{ left: '-100%' }}
                      animate={{ left: '200%' }}
                      transition={{ duration: 4, repeat: Infinity, repeatDelay: 6, ease: "easeInOut" }}
                      className="absolute top-0 bottom-0 w-[50%] skew-x-[-25deg] bg-gradient-to-r from-transparent via-amber-400/20 to-transparent"
                      style={{ willChange: "transform" }}
                    />
                  </div>
                </>
             )}
             {tier.id === 'THAT_ONE' && (
                <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/15 via-transparent to-indigo-500/5" />
             )}
             {tier.id === 'HERO' && (
                <div className="absolute inset-0 bg-gradient-to-br from-purple-500/15 via-transparent to-purple-500/5" />
             )}
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
             {tier.id === 'NPC' && (
                <div className="absolute inset-0 bg-white/[0.03]" />
             )}
             
             {/* Special Case Logic for Slot 00 (id1) Background */}
             {isSpecialAdmin && (
                <Slot00Background />
             )}
          </div>
       </UniversalCreatorCard>

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

       {/* AUTH TOAST OVERLAY */}
       <AnimatePresence>
         {showAuthToast && (
           <motion.div
             initial={{ opacity: 0, scale: 0.95 }}
             animate={{ opacity: 1, scale: 1, backgroundColor: "rgba(0, 0, 0, 0.97)" }}
             exit={{ opacity: 0, scale: 0.95 }}
             className="absolute inset-[4%] z-[100] flex flex-col items-center justify-center border-2 border-neon-purple rounded-[3rem] p-6 text-center backdrop-blur-3xl shadow-[0_0_60px_rgba(168,85,247,0.5)] pointer-events-auto"
           >
             <div className="text-4xl mb-4 drop-shadow-[0_0_15px_rgba(255,255,255,0.4)]">🤠⚡</div>
             <h4 className="text-xl font-black italic tracking-tighter mb-2 text-white">
               {toastVariant === "auth" ? "ТОРМОЗИ, КОВБОЙ!" : "ЭТО ДЕМО-КАРТОЧКА"}
             </h4>
             <p className="text-[11px] text-white/60 font-bold uppercase tracking-[0.3em] leading-relaxed">
               {toastVariant === "auth" ? "Сначала зарегистрируйся" : "Голосование доступно на реальных профилях"}
             </p>
             <button
               onClick={() => router.push(toastVariant === "auth" ? "/login" : "/profile")}
               className="mt-8 w-full py-4 rounded-2xl bg-neon-purple text-black font-black text-[11px] uppercase tracking-widest hover:bg-white transition-all shadow-[0_0_20px_rgba(168,85,247,0.4)]"
             >
               {toastVariant === "auth" ? "ВОЙТИ ⚡" : "ОТКРЫТЬ ПРОФИЛЬ ⚡"}
             </button>
           </motion.div>
         )}
       </AnimatePresence>

       {/* BURN LOG OVERLAY */}
       <AnimatePresence>
         {showBurnLog && isOwner && (
           <motion.div
             initial={{ height: 0, opacity: 0 }}
             animate={{ height: 'auto', opacity: 1 }}
             exit={{ height: 0, opacity: 0 }}
             className="absolute inset-0 z-50 bg-black/95 backdrop-blur-xl p-6 overflow-y-auto rounded-[3.5rem]"
           >
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-xs font-black uppercase text-neon-pink">Список Сжигателей</h3>
                <button onClick={() => setShowBurnLog(false)} className="text-white/40 hover:text-white">✕</button>
              </div>
              {(tier.id === 'THAT_ONE' || tier.id === 'SIGMA' || isSpecialAdmin) ? (
                <BurnLog profileId={profileId || ''} />
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
