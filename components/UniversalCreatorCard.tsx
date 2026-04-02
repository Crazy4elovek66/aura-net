"use client";

import { motion } from "framer-motion";
import { ReactNode } from "react";
import { getAuraEmoji } from "@/lib/aura";

export interface UniversalCardData {
   tier: string;
   displayName: string;
   username: string;
   avatarUrl: string | null;
   verdict: string;
   auraPoints: string;
   auraPlus: number;
   auraMinus: number;
   progress: number;
}

interface UniversalCreatorCardProps {
   data: UniversalCardData;
   children?: ReactNode;
   themeColor?: string;
   tierTextColor?: string;
   glowColor?: string;
   externalGlow?: boolean; // New prop for outer bloom
   isOwner?: boolean;
   isEditing?: boolean;
   editValue?: string;
   tier?: 'NPC' | 'HERO' | 'THAT_ONE' | 'SIGMA' | 'ADMIN' | 'RESONANCE';
   isAdmin?: boolean;
   onNameEditClick?: () => void;
   onEditChange?: (e: React.ChangeEvent<HTMLInputElement>) => void;
   onEditBlur?: () => void;
   onEditKeyDown?: (e: React.KeyboardEvent<HTMLInputElement>) => void;
    // Status Editing Props
    isEditingStatus?: boolean;
    statusValue?: string;
    onStatusEditClick?: () => void;
    onStatusChange?: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
    onStatusBlur?: () => void;
    onStatusKeyDown?: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void;
    statusClassName?: string;
    // Voting Props
    onAuraPlus?: () => void;
    onAuraMinus?: () => void;
    votePendingType?: "up" | "down" | null;
    hasVoted?: boolean;
}



const getNextTierName = (pts: number) => {
   if (pts <= 500) return "Героя";
   if (pts <= 2000) return "Того самого";
   if (pts <= 5000) return "Сигмы";
   return "Максимума";
};

const getNextTierStyle = (pts: number) => {
   if (pts <= 500) return "text-neon-purple text-glow-purple-subdued";
   if (pts <= 2000) return "text-indigo-400 text-glow-indigo";
   if (pts <= 5000) return "text-yellow-400 text-glow-yellow-intense";
   return "text-yellow-400 text-glow-yellow-intense";
};

export default function UniversalCreatorCard({
   data,
   children,
   glowColor: propGlowColor,
   isOwner = false,
   isEditing = false,
   editValue = "",
   tier = 'NPC',
   isAdmin: propIsAdmin = false,
   onNameEditClick,
   onEditChange,
   onEditBlur,
   onEditKeyDown,
   // Status Editing Props
   isEditingStatus = false,
   statusValue = "",
   onStatusEditClick,
   onStatusChange,
   onStatusBlur,
   onStatusKeyDown,
   statusClassName,
   onAuraPlus,
   onAuraMinus,
   votePendingType = null,
   hasVoted = false,
}: UniversalCreatorCardProps) {
   // Dynamic Styling based on Tier
   const isSigma = tier === 'SIGMA';
   const isHero = tier === 'HERO';
   const isThatOne = tier === 'THAT_ONE';
   const isResonance = tier === 'RESONANCE';
   const isAdmin = propIsAdmin || tier === 'ADMIN';
   
    const glowColor = propGlowColor || (isSigma ? "rgba(251,191,36,0.4)" : isThatOne ? "rgba(79,70,229,0.2)" : isResonance ? "rgba(34,211,238,0.25)" : (isHero || isAdmin) ? "rgba(168,85,247,0.3)" : "rgba(255,255,255,0.05)");
 
    const primaryGlow = glowColor;
    const auraPoints = parseFloat(data.auraPoints.replace(/\s/g, '').replace(',', '.')) * (data.auraPoints.includes('K') ? 1000 : 1);
    const emoji = isAdmin ? "👑" : isResonance ? "🧭" : getAuraEmoji(auraPoints);
    const voteInFlight = votePendingType !== null;
    const voteLocked = hasVoted || voteInFlight;
    
    // Default Tier Emojis for the "Box" if no avatar
    const defaultTierEmoji = isAdmin ? "👑" : isResonance ? "🧭" : getAuraEmoji(auraPoints);

   return (
      <div
         className={`relative w-[min(420px,85vw)] mx-auto min-h-[min(600px,90vh)] h-auto rounded-[3.5em] group select-none bg-[#050505] border transform-gpu transition-all duration-700 isolate ${
            isAdmin ? 'architect-card shadow-[0_0_60px_-10px_rgba(168,85,247,0.5)] border-purple-500/40' :
            isSigma ? 'border-yellow-400/60' :
            isThatOne ? 'border-indigo-500/50' :
            isResonance ? 'resonance-card border-cyan-400/45' :
            isHero ? 'border-purple-500/40' :
            'border-white/[0.08] shadow-2xl'
         }`}
         style={{
            /* [SCALE] Скорректированный масштаб (уточненный для иерархии) */
            fontSize: 'clamp(12px, 0.85rem + 0.4vw, 22px)',
            boxShadow: isSigma || isAdmin
               ? `0 0 50px -10px ${primaryGlow}`
               : isThatOne
               ? `0 0 35px -10px ${primaryGlow}`
               : isResonance
               ? `0 0 28px -12px ${primaryGlow}`
               : isHero 
               ? "0 20px 40px rgba(0,0,0,0.5)"
               : "0 30px 60px rgba(0,0,0,0.8)"
         }}
      >
         {/* Background Layer (Animations) - Fixed Clipping */}
         <div className="absolute inset-0 z-0 rounded-[3.5em] overflow-hidden">
            {children}
         </div>

         {/* Main Content Layer */}
         <div className="relative z-20 flex flex-col h-full p-[1.5em] justify-between min-h-[min(580px,85vh)] gap-y-[1em]" style={{ transform: "translateZ(80px)" }}>

            {/* TOP SECTION: Tier, Identity & Avatar */}
            <div className="grid grid-cols-[1fr_auto] items-start gap-3 relative z-30">
               <div className="flex flex-col min-w-0 flex-1 p-[0.5em] -m-[0.5em]">
                  <div className="flex items-center gap-[0.5em] mb-[0.2em] min-h-[2.2em]">
                     <span className={`text-[0.75em] font-black uppercase tracking-[0.2em] leading-none translate-y-[0.15em] ${
                        isAdmin ? 'text-white architect-text-glow' :
                        isSigma ? 'text-yellow-400 text-glow-yellow-intense' : 
                        isThatOne ? 'text-indigo-400 text-glow-indigo-intense' :
                        isResonance ? 'text-cyan-300 resonance-text-glow' :
                        isHero ? 'text-purple-400' : 
                        'text-white/70'
                     }`}>
                        {isAdmin ? "АРХИТЕКТОР" : isResonance ? "РЕЗОНАНС" : data.tier}
                     </span>
                     {/* DYNAMIC EMOJI BADGE (REFINED SCALE) */}
                     <div className="relative w-[2.6em] sm:w-[2.2em] h-[2.6em] sm:h-[2.2em] rounded-full bg-white/[0.05] border border-white/10 backdrop-blur-md shadow-2xl transition-transform group-hover:scale-110 flex-none self-center overflow-hidden">
                        <span className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-[52%] text-[1.6em] sm:text-[1.4em] drop-shadow-[0_0_12px_rgba(255,255,255,0.4)] leading-none select-none">
                           {emoji}
                        </span>
                     </div>
                  </div>
                  <div className="flex items-center gap-1 group/name flex-1 min-w-0">
                     {isEditing ? (
                        <div className="flex-1 min-w-0 h-[2em] flex items-center">
                           <input
                              autoFocus
                              value={editValue}
                              onChange={onEditChange}
                              onBlur={onEditBlur}
                              onKeyDown={onEditKeyDown}
                              className={`bg-white/10 border-none outline-none rounded-lg px-2 py-1 text-[1.6em] font-black italic tracking-tighter w-full min-w-0 text-white leading-none ${
                                 isAdmin ? 'architect-text-glow' :
                                 isSigma ? 'text-yellow-400 text-glow-yellow-intense' : 
                                 isThatOne ? 'text-indigo-400 text-glow-indigo-intense' :
                                 isResonance ? 'text-cyan-300 resonance-text-glow' :
                                 isHero ? 'text-purple-400' : 
                                 'text-white'
                              }`}
                           />
                        </div>
                     ) : (
                        <div className="flex-1 min-w-0 relative h-[2em] flex items-center">
                           <div className="name-fade-mask w-full">
                              <h2 
                                 onClick={onNameEditClick}
                                 className={`text-[1.6em] font-black italic tracking-tighter leading-none whitespace-nowrap ${
                                  isAdmin ? 'text-white architect-text-glow' :
                                  isSigma ? 'text-yellow-400 text-glow-yellow-intense' : 
                                  isThatOne ? 'text-indigo-400 text-glow-indigo-intense' :
                                  isResonance ? 'text-cyan-300 resonance-text-glow' :
                                  isHero ? 'text-purple-400' : 
                                  'text-white'
                              } ${isOwner ? 'cursor-pointer hover:text-white/80' : ''}`}
                           >
                              {data.displayName}
                           </h2>
                         </div>
                       </div>
                     )}
                  </div>
                  <p className="text-[0.85em] font-bold text-white/50 tracking-tight mt-[0.3em] drop-shadow-sm">
                     @{data.username}
                  </p>
               </div>

                        {/* STANDARDIZED IDENTITY BOX (SIZE & POSITION FROM SLOT 00) */}
               <div className="relative group/avatar flex-none">
                  {/* ADMIN CYBER-RINGS (FULL SYSTEM CORE STYLE) */}
                  {isAdmin && (
                     <div className="absolute inset-0 z-0 pointer-events-none">
                        <div className="absolute -inset-[0.7em] sm:-inset-[0.8em] rounded-full border-[1.5px] border-purple-500/20 border-t-purple-400 border-b-purple-400 shadow-[0_0_15px_rgba(168,85,247,0.4)] animate-[spin_10s_linear_infinite]" style={{ willChange: "transform" }} />
                        <div className="absolute -inset-[0.25em] sm:-inset-[0.3em] rounded-full border-[2px] border-purple-400/10 border-l-purple-300 border-r-purple-300 shadow-[0_0_10px_rgba(168,85,247,0.6)] animate-[spin_6s_linear_infinite_reverse]" style={{ willChange: "transform" }} />
                     </div>
                  )}
                  {isResonance && (
                     <div className="absolute inset-0 z-0 pointer-events-none">
                        <div className="absolute -inset-[0.2em] rounded-2xl border border-cyan-300/40 shadow-[0_0_10px_rgba(34,211,238,0.25)]" />
                     </div>
                  )}
                  <div className={`w-[5em] sm:w-[4.5em] h-[5em] sm:h-[4.5em] flex items-center justify-center transition-all duration-500 relative z-10 overflow-hidden ${
                        isAdmin ? 'rounded-full hover:shadow-[0_0_20px_rgba(168,85,247,0.4)]' :
                        isSigma ? 'rounded-2xl bg-yellow-500/10 border-2 border-yellow-400 shadow-[0_0_15px_rgba(234,179,8,0.2)]' :
                        isThatOne ? 'rounded-2xl bg-indigo-500/10 border-2 border-indigo-400 shadow-[0_0_15px_rgba(99,102,241,0.2)]' :
                        isResonance ? 'rounded-2xl bg-cyan-500/10 border-2 border-cyan-300/70 shadow-[0_0_12px_rgba(34,211,238,0.25)]' :
                        isHero ? 'rounded-2xl bg-purple-500/10 border-2 border-purple-400 shadow-[0_0_15px_rgba(168,85,247,0.2)]' :
                        'rounded-2xl bg-white/5 border-2 border-white/20 shadow-inner'
                     }`}
                  >
                     {data.avatarUrl ? (
                        <img 
                           src={data.avatarUrl} 
                           alt={data.displayName}
                           crossOrigin="anonymous"
                           className={`w-full h-full object-cover ${isAdmin ? 'rounded-full' : 'rounded-[14px]'}`} 
                        />
                     ) : (
                        <span className="flex items-center justify-center w-full h-full pb-[0.1em] text-[3.2em] sm:text-[2.8em]">{defaultTierEmoji}</span>
                     )}
                  </div>
               </div>

            </div>

            {/* MIDDLE SECTION: Editable Status Box */}
            <div className={`mt-[0.8em] px-[0.1em] w-full ${tier === 'NPC' ? 'opacity-40 grayscale-[0.5]' : ''}`}>
               <div 
                  onClick={tier === 'NPC' ? undefined : onStatusEditClick}
                  className={`relative rounded-[2em] bg-white/[0.03] border border-white/[0.05] p-[1em] backdrop-blur-md w-full ${isEditingStatus ? 'min-h-[8em]' : 'min-h-[6em]'} flex flex-col justify-between transition-all duration-300 ${
                     (isOwner && tier !== 'NPC') ? 'cursor-pointer hover:bg-white/[0.06] hover:border-white/[0.1]' : ''
                  }`}
               >
                  {(tier !== 'NPC' || isAdmin) && (
                     <div 
                        className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-3/5 rounded-full" 
                        style={{ 
                           backgroundColor: isSigma ? '#eab308' : isThatOne ? '#6366f1' : isResonance ? '#22d3ee' : '#a855f7',
                           boxShadow: `0 0 10px ${primaryGlow}` 
                        }} 
                     />
                  )}
                  
                  {isEditingStatus ? (
                        <textarea
                           autoFocus
                           maxLength={120}
                           value={statusValue}
                           onChange={onStatusChange}
                           onBlur={onStatusBlur}
                           onKeyDown={onStatusKeyDown}
                           className={`bg-transparent border-none outline-none font-semibold text-white italic leading-snug w-full min-w-0 resize-none h-full min-h-[4em] ${isAdmin ? 'text-[0.8em]' : 'text-[0.7em]'}`}
                           placeholder="О чем думаешь?..."
                        />
                  ) : (
                     <div className="py-[0.2em]">
                        <p className={`font-semibold italic leading-snug pr-[0.1em] ${
                           isAdmin ? 'text-white architect-text-glow text-[0.8em]' : isResonance ? 'text-cyan-100/95 resonance-text-glow text-[0.75em]' : 'text-white/90 text-[0.7em]'
                        } ${statusClassName || ''}`}>
                           {tier === 'NPC' ? '"У NPC нет своих мыслей. Только предустановленные скрипты."' : `"${data.verdict}"`}
                        </p>
                     </div>
                  )}
                  
                  <div className="flex items-center justify-between mt-[0.8em]">
                     <div className="flex items-center gap-[0.4em] h-[1em]">
                        {(tier !== 'NPC' || isAdmin) && (
                           <div 
                              className="w-[0.4em] h-[0.4em] rounded-full animate-pulse self-center" 
                              style={{ backgroundColor: isSigma ? '#eab308' : isThatOne ? '#6366f1' : isResonance ? '#22d3ee' : '#a855f7' }}
                           />
                        )}
                        <span className="text-[0.55em] font-black text-white/30 uppercase tracking-[0.2em]">
                           {tier === 'NPC' ? 'СИСТЕМА' : 'МЫСЛИ'}
                        </span>
                     </div>
                     {isEditingStatus && (
                        <span className="text-[0.5em] font-mono text-white/20">
                           {statusValue?.length}/120
                        </span>
                     )}
                  </div>
               </div>
            </div>

            <div className="pt-[1.5em] space-y-[1.2em]">
               <div className="px-[0.5em]">
                  <span className="text-[0.75em] font-black text-white/50 uppercase tracking-[0.5em] block mb-[0.2em] drop-shadow-sm">
                     Очки ауры
                  </span>
                  <div className="flex flex-col">
                     <div className="flex flex-col gap-[0.2em]">
                        <span className={`text-[3.2em] font-black italic tracking-tighter leading-none drop-shadow-[0_10px_30px_rgba(0,0,0,0.5)] ${
                           isAdmin ? 'text-white architect-text-glow' :
                           isSigma ? 'text-yellow-400 sigma-points-animate' : 
                           isThatOne ? 'text-indigo-400 text-glow-indigo-intense' :
                           isResonance ? 'text-cyan-300 resonance-text-glow' :
                           isHero ? 'text-purple-400' : 
                           'text-white'
                        }`}>
                           {data.auraPoints}
                        </span>
                        <div className="flex items-center gap-[0.8em] pl-[0.1em]">
                           <span className="text-[1.1em] sm:text-[0.7em] text-green-400 font-bold drop-shadow-sm whitespace-nowrap">▲ {data.auraPlus}</span>
                           <span className="text-[1.1em] sm:text-[0.7em] text-pink-400 font-bold drop-shadow-sm whitespace-nowrap">▼ {data.auraMinus}</span>
                        </div>
                     </div>
                  </div>
               </div>

               {/* Progress Bar Section (Unified) */}
               <div className="px-[0.5em] space-y-[0.8em]">
                  <div className="flex justify-between items-end px-1 relative z-30">
                     <span className="text-[0.75em] font-black text-white/50 uppercase tracking-[0.2em] drop-shadow-sm">
                        Прогресс до <span className={`${getNextTierStyle(auraPoints)} transition-all duration-500`}>{getNextTierName(auraPoints).toUpperCase()}</span>
                     </span>
                     <span className="text-[0.75em] font-black text-white/90 italic tracking-tighter">
                        {Math.round(data.progress)}%
                     </span>
                  </div>
                  
                  <div className="h-[0.65em] w-full bg-white/10 rounded-full relative border border-white/5 overflow-visible">
                     <motion.div
                        initial={{ width: 0 }}
                        animate={{ 
                           width: `${data.progress}%`,
                        }}
                        transition={{ duration: 1.5, ease: "easeOut" }}
                        className={`absolute inset-y-0 left-0 rounded-full ${auraPoints >= 5000 ? 'animate-shimmer' : ''}`}
                        style={{ 
                           background: auraPoints >= 5000 
                              ? 'linear-gradient(90deg, #eab308 0%, #fef08a 50%, #eab308 100%)' 
                              : auraPoints >= 2000 ? '#6366f1' : auraPoints >= 500 ? '#a855f7' : 'rgba(255,255,255,0.4)',
                           backgroundSize: auraPoints >= 5000 ? '200% 100%' : 'auto',
                           boxShadow: (auraPoints >= 2000) ? `0 0 25px ${primaryGlow}` : 'none'
                        }}
                     />
                  </div>
               </div>

               {/* Footer Actions (Conditional) */}
               {!isOwner && (
                 <div className="space-y-[0.5em]">
                    <div className="grid grid-cols-2 gap-[0.6em]">
                    <button 
                       onClick={onAuraPlus}
                       disabled={voteLocked || !onAuraPlus}
                       className={`py-[0.8em] rounded-[1.2em] border-2 border-neon-green/20 bg-neon-green/5 text-neon-green font-black text-[0.7em] uppercase tracking-[0.2em] flex items-center justify-center gap-[0.3em] transition-all shadow-lg backdrop-blur-sm ${
                        voteLocked || !onAuraPlus
                          ? "opacity-60 cursor-not-allowed"
                          : "hover:bg-neon-green/10 active:scale-95"
                       }`}
                    >
                       <span className="text-[1.4em]">⚡</span> {votePendingType === "up" ? "ОБРАБОТКА..." : "АУРА+"}
                    </button>
                    <button 
                       onClick={onAuraMinus}
                       disabled={voteLocked || !onAuraMinus}
                       className={`py-[0.8em] rounded-[1.2em] border-2 border-neon-pink/20 bg-neon-pink/5 text-neon-pink font-black text-[0.7em] uppercase tracking-[0.2em] flex items-center justify-center gap-[0.3em] transition-all shadow-lg backdrop-blur-sm ${
                        voteLocked || !onAuraMinus
                          ? "opacity-60 cursor-not-allowed"
                          : "hover:bg-neon-pink/10 active:scale-95"
                       }`}
                    >
                       <span className="text-[1.4em]">💀</span> {votePendingType === "down" ? "ОБРАБОТКА..." : "АУРА-"}
                    </button>
                    </div>
                    {hasVoted && (
                      <p className="text-center text-[0.55em] uppercase tracking-[0.18em] text-white/45 font-black">
                        Голос уже учтен
                      </p>
                    )}
                 </div>
               )}
            </div>

         </div>
      </div>
   );
}

