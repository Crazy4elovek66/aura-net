"use client";

import { motion, useMotionValue, useSpring, useTransform } from "framer-motion";
import { useEffect, useState } from "react";

interface CreatorCardProps {
  username: string;
  displayName: string;
  avatarUrl: string | null;
}

export default function CreatorCardAbsoluteZero({
  username,
  displayName,
  avatarUrl,
}: CreatorCardProps) {
  const mouseX = useSpring(useMotionValue(0), { stiffness: 100, damping: 30 });
  const mouseY = useSpring(useMotionValue(0), { stiffness: 100, damping: 30 });

  const rotateX = useTransform(mouseY, [-400, 400], [8, -8]);
  const rotateY = useTransform(mouseX, [-400, 400], [-8, 8]);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left - rect.width / 2;
    const y = e.clientY - rect.top - rect.height / 2;
    mouseX.set(x);
    mouseY.set(y);
  };

  const handleMouseLeave = () => {
    mouseX.set(0);
    mouseY.set(0);
  };

  return (
    <motion.div
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      style={{
        rotateX,
        rotateY,
        transformStyle: "preserve-3d",
        perspective: 1000,
      }}
      className="relative w-full max-w-[360px] aspect-[9/13] rounded-[3.5rem] p-10 flex flex-col justify-between overflow-hidden group select-none bg-black shadow-[0_0_100px_rgba(255,255,255,0.15)] border-2 border-white animate-pulse"
    >
      {/* 1. Белое свечение (Absolute Zero Glow) */}
      <div className="absolute inset-0 z-0 pointer-events-none overflow-hidden">
        <motion.div 
           animate={{
             filter: ["blur(60px)", "blur(100px)", "blur(60px)"],
             opacity: [0.3, 0.6, 0.3],
           }}
           transition={{ duration: 4, repeat: Infinity }}
           className="absolute top-0 left-0 w-full h-full bg-white opacity-40 blur-[80px]"
        />
        {/* Серебряный градиент на фоне */}
        <div className="absolute inset-x-[-50%] inset-y-[-50%] bg-[radial-gradient(circle_at_center,white_0%,transparent_70%)] opacity-10 animate-pulse" />
      </div>

      {/* 2. Морозилка (Icy Overlay) */}
      <div className="absolute inset-0 z-5 pointer-events-none opacity-20 bg-[url('https://graining.gradient.app/noise.svg')] contrast-150 grayscale" />

      {/* Content */}
      <div className="relative z-20 flex flex-col h-full justify-between" style={{ transform: "translateZ(70px)" }}>
        {/* Top: Branding */}
        <div className="flex justify-between items-start">
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-3">
                <span className="text-[10px] font-black text-black px-4 py-1 bg-white rounded-md tracking-[0.5em] uppercase shadow-[0_0_30px_#fff]">
                   ZERO
                </span>
                <span className="text-xl text-white">⚡</span>
            </div>
            <h2 className="text-4xl font-black italic tracking-tighter text-white uppercase drop-shadow-[0_0_10px_rgba(255,255,255,0.8)]">
               {displayName}
            </h2>
          </div>

          <div className="relative w-16 h-16 group/avatar">
             <div className="absolute inset-0 bg-white rounded-2xl blur-lg opacity-40 group-hover:opacity-100 transition-opacity" />
             <div className="w-full h-full rounded-2xl border-2 border-white bg-black overflow-hidden p-1 relative z-10 shadow-[0_0_20px_#fff]">
                {avatarUrl ? (
                    <img src={avatarUrl} alt={displayName} className="w-full h-full object-cover rounded-xl grayscale brightness-150" />
                ) : (
                    <div className="w-full h-full flex items-center justify-center text-4xl saturate-0">⚡</div>
                )}
             </div>
          </div>
        </div>

        {/* Oracle Verdict */}
        <div className="space-y-6 text-center">
           <div className="h-[2px] w-full bg-white shadow-[0_0_15px_#fff]" />
           <p className="text-[14px] font-black italic text-white leading-tight uppercase tracking-tight">
             «Его аура — это белый шум. Он видел начало этого чата и увидит его конец. Ultimate Boss.»
           </p>
           <div className="h-[2px] w-full bg-white shadow-[0_0_15px_#fff]" />
        </div>

        {/* Bottom */}
        <div className="space-y-8">
          <div className="flex justify-between items-end">
            <div className="flex flex-col gap-1">
               <span className="text-[9px] font-black text-white/40 uppercase tracking-[0.5em] mb-1">Aura Potential</span>
               <div className="flex items-baseline gap-2">
                  <span className="text-6xl font-black italic tracking-tighter text-white drop-shadow-[0_0_15px_white]">∞</span>
               </div>
            </div>
            
            <div className="flex flex-col items-end gap-3 pb-2">
               <div className="flex flex-col items-end">
                 <span className="text-[9px] font-black text-white/50 tracking-[0.3em] uppercase">Status</span>
                 <span className="text-[14px] font-black italic text-white drop-shadow-[0_0_10px_#fff]">ROOT_USER</span>
               </div>
               <div className="flex gap-2">
                   {[1,2,3,4,5].map(i => (
                     <div key={i} className="w-5 h-1 bg-white rounded-full shadow-[0_0_10px_#fff]" />
                   ))}
               </div>
            </div>
          </div>

          <button className="w-full py-6 rounded-2xl bg-white text-black font-black text-[12px] uppercase tracking-[1em] transition-all duration-300 hover:tracking-[1.2em] active:scale-95 shadow-[0_40px_80px_#fff2]">
             AUTHORIZE
          </button>
        </div>
      </div>
    </motion.div>
  );
}
