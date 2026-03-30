"use client";

import { useMemo } from "react";
import { motion } from "framer-motion";
import UniversalCreatorCard from "./UniversalCreatorCard";

interface CreatorCardProps {
   username: string;
   displayName: string;
   avatarUrl: string | null;
   auraPoints: number;
   votesUp: number;
   votesDown: number;
   progress: number;
   isOwner?: boolean;
   isEditing?: boolean;
   editValue?: string;
   onNameEditClick?: () => void;
   onEditChange?: (e: React.ChangeEvent<HTMLInputElement>) => void;
   onEditBlur?: () => void;
   onEditKeyDown?: (e: React.KeyboardEvent<HTMLInputElement>) => void;
}

export default function CreatorCardSlot00({
   username,
   displayName,
   avatarUrl,
   auraPoints,
   votesUp,
   votesDown,
   progress,
   isOwner,
   isEditing,
   editValue,
   onNameEditClick,
   onEditChange,
   onEditBlur,
   onEditKeyDown,
}: CreatorCardProps) {

   // 1. Matrix Animation Logic (Unique to Slot 00)
   const codeColumns = 20;
   const codeFragments = ["aura", "net", "root", "sys", "01", "exec", "init", "node", "x8f", "0x0", "seed", "core", "data"];

   const matrixStreams = useMemo(() => {
      // ... same logic ...
      return Array.from({ length: codeColumns }).map((_, i) => {
         const columnWords = Array.from({ length: 60 }).map((_, wordIdx) => {
            const fragmentIdx = Math.floor(((i * 7 + wordIdx * 13) % codeFragments.length));
            return codeFragments[fragmentIdx];
         });

         return {
            id: i,
            left: (i * (100 / (codeColumns - 1))) + "%",
            delay: -(Math.sin(i * 0.9) * 20 + 20),
            duration: 45,
            opacity: 0.15 + ((i * 31) % 40) / 100,
            words: columnWords
         };
      });
   }, []);

   // 2. Profile Data (Formatted for Universal Blueprint)
   const profileData = {
      tier: "МЕСТНЫЙ",
      displayName: displayName,
      username: username,
      avatarUrl: avatarUrl,
      verdict: "Анализируем твою базу... Подожди секунду, ROOT.",
      auraPoints: (auraPoints / 1000).toFixed(1) + "K",
      auraPlus: votesUp,
      auraMinus: votesDown,
      progress: progress
   };

   return (
      <UniversalCreatorCard
         data={profileData}
         themeColor="purple-500"
         glowColor="rgba(168,85,247,0.4)"
         externalGlow={true}
         isOwner={isOwner}
         isEditing={isEditing}
         editValue={editValue}
         onNameEditClick={onNameEditClick}
         onEditChange={onEditChange}
         onEditBlur={onEditBlur}
         onEditKeyDown={onEditKeyDown}
      >
         {/* BACKGROUND: Purple Matrix & Aurora (Unique to Slot 00) */}
         <div className="absolute inset-0 z-0">
            {/* Aurora Foundation */}
            <div className="absolute inset-0 opacity-60 pointer-events-none">
               <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-transparent z-10" />
               <motion.div
                  animate={{ x: [0, -30, 30, 0], rotate: [5, -5, 5], opacity: [0.3, 0.5, 0.3] }}
                  transition={{ duration: 18, repeat: Infinity, ease: "easeInOut" }}
                  className="absolute -top-1/2 -left-1/2 w-[200%] h-[150%] bg-[radial-gradient(ellipse_at_center,rgba(168,85,247,0.3)_0%,transparent_60%)] blur-[110px] transform-gpu"
               />
            </div>

            {/* Matrix Rain */}
            <div
               className="absolute inset-x-0 -top-20 -bottom-20 z-5 pointer-events-none overflow-hidden mix-blend-screen opacity-40"
               style={{
                  maskImage: 'linear-gradient(to bottom, transparent, black 15%, black 85%, transparent)',
                  WebkitMaskImage: 'linear-gradient(to bottom, transparent, black 15%, black 85%, transparent)'
               }}
            >
               {matrixStreams.map((stream) => (
                  <div key={stream.id} className="absolute inset-y-0" style={{ left: stream.left, width: "18px" }}>
                     <motion.div
                        initial={{ y: "-50%" }}
                        animate={{ y: "0%" }}
                        transition={{ duration: stream.duration, repeat: Infinity, delay: stream.delay, ease: "linear" }}
                        className="flex flex-col gap-10 items-center justify-start h-auto"
                        style={{ willChange: "transform", transform: "translateZ(0)" }}
                     >
                        {[...stream.words, ...stream.words].map((word, idx) => (
                           <span
                              key={idx}
                              className="text-[8px] font-mono font-black uppercase tracking-tighter text-purple-400 [writing-mode:vertical-rl]"
                              style={{ opacity: stream.opacity, textShadow: "0 0 4px rgba(168,85,247,0.6)", filter: "blur(0.2px)" }}
                           >
                              {word}
                           </span>
                        ))}
                     </motion.div>
                  </div>
               ))}
            </div>
         </div>
      </UniversalCreatorCard>
   );
}
