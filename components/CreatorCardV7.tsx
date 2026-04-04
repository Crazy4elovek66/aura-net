"use client";

import { motion, useMotionValue, useSpring, useTransform } from "framer-motion";
import { useEffect, useState } from "react";

interface CreatorCardProps {
  username: string;
  displayName: string;
  avatarUrl: string | null;
}

export default function CreatorCardV7({
  username,
  displayName,
  avatarUrl,
}: CreatorCardProps) {
  const mouseX = useSpring(useMotionValue(0), { stiffness: 100, damping: 30 });
  const mouseY = useSpring(useMotionValue(0), { stiffness: 100, damping: 30 });

  const rotateX = useTransform(mouseY, [-400, 400], [12, -12]);
  const rotateY = useTransform(mouseX, [-400, 400], [-12, 12]);

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
      className="relative w-full max-w-[360px] aspect-[9/13] rounded-[4rem] p-10 flex flex-col justify-between overflow-hidden group select-none bg-black shadow-[0_60px_120px_rgba(0,0,0,1)] border border-white/5"
    >
      {/* 1. Аккреционный диск (Event Horizon Disk) */}
      <div className="absolute inset-x-[-50%] top-1/4 h-1/2 z-0 pointer-events-none origin-center opacity-40">
        <motion.div 
          animate={{ rotate: 360 }}
          transition={{ duration: 12, repeat: Infinity, ease: "linear" }}
          className="w-full h-full bg-[conic-gradient(from_0deg,transparent,rgba(255,255,255,0.05),rgba(255,255,255,0.2),rgba(255,255,255,0.05),transparent)] blur-xl"
        />
        {/* Вторая фаза (обратное вращение) */}
        <motion.div 
          animate={{ rotate: -360 }}
          transition={{ duration: 25, repeat: Infinity, ease: "linear" }}
          className="absolute inset-0 bg-[conic-gradient(from_180deg,transparent,rgba(255,255,255,0.02),rgba(255,255,255,0.1),rgba(255,255,255,0.02),transparent)] blur-2xl"
        />
      </div>

      {/* Гравитационное искажение (Lens) */}
      <motion.div 
        style={{
          x: useTransform(mouseX, [-400, 400], [-40, 40]),
          y: useTransform(mouseY, [-400, 400], [-40, 40]),
        }}
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-48 h-48 bg-black rounded-full z-5 shadow-[0_0_80px_rgba(255,255,255,0.1)] blur-sm"
      />

      {/* 2. Контент с эффектом парения */}
      <div className="relative z-20 flex flex-col h-full justify-between" style={{ transform: "translateZ(100px)" }}>
        {/* Header */}
        <div className="flex justify-between items-start">
          <div className="flex flex-col gap-2">
            <div className="w-fit px-3 py-0.5 rounded-full border border-white/20 text-[8px] font-black uppercase tracking-[0.6em] text-white/50 bg-black/40">
              SINGULARITY
            </div>
            <h2 className="text-4xl font-black italic tracking-tighter text-white drop-shadow-2xl">
              {displayName}
            </h2>
          </div>
          
          <div className="w-16 h-16 rounded-3xl border border-white/10 bg-black p-0.5 overflow-hidden shadow-2xl skew-x-[-10deg]">
             {avatarUrl ? (
                 <img src={avatarUrl} alt={displayName} className="w-full h-full object-cover rounded-[1.2rem]" />
             ) : (
                 <div className="w-full h-full flex items-center justify-center text-3xl">🕳️</div>
             )}
          </div>
        </div>

        {/* Center: Quote */}
        <div className="text-center">
           <p className="text-[14px] font-black italic text-white leading-tight uppercase tracking-[-0.05em] scale-y-150 opacity-80">
             «Beyond the light, there is only us.»
           </p>
        </div>

        {/* Bottom */}
        <div className="space-y-6">
          <div className="flex justify-between items-end">
            <div className="flex flex-col gap-3">
              <span className="text-[9px] font-black text-white/20 uppercase tracking-[0.4em]">Mass Index</span>
              <div className="flex items-center gap-1">
                 <span className="text-4xl font-black italic text-white">∞</span>
                 <div className="w-1.5 h-1.5 rounded-full bg-white/20" />
                 <span className="text-[9px] font-bold text-white/40 uppercase">Aura Units</span>
              </div>
            </div>
            
            <div className="flex flex-col items-end gap-2">
               <div className="flex items-center gap-2">
                  <div className="w-5 h-1 bg-white" />
                  <span className="text-[10px] font-black text-white/60 tracking-widest uppercase">HORIZON SAFE</span>
               </div>
               <div className="text-[8px] font-bold text-white/20 uppercase tracking-widest">Master Override Active</div>
            </div>
          </div>

          <button className="w-full py-6 rounded-[2.5rem] bg-white text-black font-black text-[12px] uppercase tracking-[0.8em] overflow-hidden relative group/btn">
             <motion.div 
               animate={{ x: ["-100%", "100%"] }}
               transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
               className="absolute inset-0 bg-gradient-to-r from-transparent via-black/5 to-transparent skew-x-[-20deg]"
             />
             <span className="relative z-10 transition-all duration-500 group-hover/btn:tracking-[1em]">ПЕРЕЙТИ</span>
          </button>
        </div>
      </div>

      <style jsx>{`
        .perspective-1000 {
          perspective: 1000px;
        }
      `}</style>
    </motion.div>
  );
}
