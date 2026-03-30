"use client";

import { motion, useMotionValue, useSpring, useTransform } from "framer-motion";
import { useEffect, useState } from "react";

interface CreatorCardProps {
  username: string;
  displayName: string;
  avatarUrl: string | null;
}

export default function CreatorCardArchitectV2({
  username,
  displayName,
  avatarUrl,
}: CreatorCardProps) {
  const mouseX = useSpring(useMotionValue(0), { stiffness: 100, damping: 30 });
  const mouseY = useSpring(useMotionValue(0), { stiffness: 100, damping: 30 });

  const rotateX = useTransform(mouseY, [-400, 400], [7, -7]);
  const rotateY = useTransform(mouseX, [-400, 400], [-7, 7]);

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
      className="relative w-full max-w-[360px] aspect-[9/13] rounded-[3rem] p-10 flex flex-col justify-between overflow-hidden group select-none bg-black shadow-[0_40px_80px_rgba(255,255,255,0.05)] border-[1px] border-white/20 transform-gpu"
      style={{
        rotateX,
        rotateY,
        transformStyle: "preserve-3d",
        perspective: 1000,
        willChange: "transform",
      }}
    >
      {/* 1. Platinum Core Effects (Cold White Glow) */}
      <div className="absolute inset-0 z-0 pointer-events-none">
        <motion.div 
           animate={{
             opacity: [0.2, 0.4, 0.2],
             scale: [0.9, 1.1, 0.9],
           }}
           transition={{ duration: 6, repeat: Infinity }}
           className="absolute -top-[20%] -left-[20%] w-[140%] h-[140%] bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.25)_0%,transparent_60%)] blur-[100px]"
        />
        <div className="absolute inset-0 bg-gradient-to-br from-white/10 via-transparent to-white/10 opacity-60" />
      </div>

      {/* 2. Silver Border Accents */}
      <div className="absolute inset-0 z-10 pointer-events-none rounded-[3rem] border border-white/5" />
      <div className="absolute inset-0 z-10 pointer-events-none rounded-[3rem] shadow-[inset_0_0_20px_rgba(255,255,255,0.05)]" />

      {/* Content */}
      <div className="relative z-20 flex flex-col h-full justify-between" style={{ transform: "translateZ(50px)" }}>
        {/* Top: Branding */}
        <div className="flex justify-between items-start">
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-3">
                <span className="text-[10px] font-black text-white px-3 py-1 bg-white/10 rounded-sm tracking-[0.5em] uppercase border border-white/20">
                   АРХИТЕКТОР
                </span>
                <span className="text-xl text-white/80 drop-shadow-[0_0_10px_white]">✦</span>
            </div>
            <h2 className="text-4xl font-black italic tracking-tighter text-white uppercase opacity-90">
               {displayName}
            </h2>
          </div>

          <div className="relative w-16 h-16 group/avatar">
             <div className="w-full h-full rounded-2xl border border-white/30 bg-black/60 backdrop-blur-md overflow-hidden p-1 shadow-2xl relative z-10">
                {avatarUrl ? (
                    <img src={avatarUrl} alt={displayName} className="w-full h-full object-cover rounded-xl grayscale brightness-125" />
                ) : (
                    <div className="w-full h-full flex items-center justify-center text-4xl opacity-80">◈</div>
                )}
             </div>
          </div>
        </div>

        {/* Center: Systemic Verdict */}
        <div className="space-y-4 text-center">
           <div className="h-[1px] w-full bg-gradient-to-r from-transparent via-white/20 to-transparent" />
           <div className="flex flex-col gap-1 px-2">
             <p className="text-[11px] font-black text-white/80 uppercase tracking-tight leading-tight italic">
               «Система знает это имя в исходном коде.»
             </p>
             <p className="text-[9px] font-bold text-white/40 uppercase tracking-widest leading-relaxed">
               Не проходит ранговую оценку. Формирует её.
             </p>
           </div>
           <div className="h-[1px] w-full bg-gradient-to-r from-transparent via-white/20 to-transparent" />
        </div>

        {/* Bottom */}
        <div className="space-y-8">
          <div className="flex justify-between items-end">
            <div className="flex flex-col gap-1">
               <span className="text-[9px] font-black text-white/20 uppercase tracking-[0.5em] mb-1">Вес в системе</span>
               <div className="flex items-baseline gap-2">
                  <span className="text-6xl font-black italic tracking-tighter text-white drop-shadow-[0_0_15px_rgba(255,255,255,0.4)]">∞</span>
                  <span className="text-[10px] font-black text-white/20 uppercase mb-2">LVL</span>
               </div>
            </div>
            
            <div className="flex flex-col items-end gap-3 pb-2">
               <div className="flex flex-col items-end opacity-60">
                 <span className="text-[8px] font-black text-white/40 tracking-[0.3em] uppercase">Matrix Status</span>
                 <span className="text-[14px] font-black italic text-white uppercase tracking-tighter font-mono">CORE_ENTITY</span>
               </div>
               <div className="flex gap-1">
                   {[1,2,3,4,5].map(i => (
                     <div key={i} className="w-3 h-3 border border-white/20 rounded-full scale-75" />
                   ))}
               </div>
            </div>
          </div>

          <button className="w-full py-6 rounded-2xl bg-white text-black font-black text-[12px] uppercase tracking-[0.8em] transition-all duration-300 hover:tracking-[1em] active:scale-95 shadow-[0_30px_60px_-15px_rgba(255,255,255,0.2)]">
             CONFIGURE
          </button>
        </div>
      </div>
    </motion.div>
  );
}
