"use client";

import { motion, useMotionValue, useSpring, useTransform } from "framer-motion";
import { useEffect, useState } from "react";

interface CreatorCardProps {
  username: string;
  displayName: string;
  avatarUrl: string | null;
}

export default function CreatorCardPrime({
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
        perspective: 1100,
        willChange: "transform",
      }}
      className="relative w-full max-w-[360px] aspect-[9/13] rounded-[3.5rem] p-10 flex flex-col justify-between overflow-hidden group select-none bg-zinc-950 shadow-[0_45px_100px_rgba(0,0,0,1)] border border-white/10 transform-gpu"
    >
      {/* 1. Prime Effects (White + Violet Glow) */}
      <div className="absolute inset-0 z-0 pointer-events-none">
        <motion.div 
           animate={{
             x: [-50, 50, -50],
             opacity: [0.2, 0.45, 0.2],
           }}
           transition={{ duration: 10, repeat: Infinity }}
           className="absolute top-0 right-0 w-[120%] h-[120%] bg-[radial-gradient(circle_at_center,rgba(168,85,247,0.2)_0%,transparent_60%)] blur-[100px]"
        />
        <motion.div 
           animate={{
             x: [50, -50, 50],
             opacity: [0.2, 0.45, 0.2],
           }}
           transition={{ duration: 8, repeat: Infinity, delay: 2 }}
           className="absolute bottom-0 left-0 w-[120%] h-[120%] bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.15)_0%,transparent_60%)] blur-[100px]"
        />
        <div className="absolute inset-0 bg-gradient-to-br from-white/10 via-transparent to-white/10 opacity-70" />
      </div>

      {/* 2. Lux Border */}
      <div className="absolute inset-x-4 inset-y-4 z-10 pointer-events-none rounded-[3rem] border border-white/5" />
      <div className="absolute inset-0 z-10 pointer-events-none rounded-[3.5rem] shadow-[inset_0_0_40px_rgba(255,255,255,0.02)]" />

      {/* Content */}
      <div className="relative z-20 flex flex-col h-full justify-between" style={{ transform: "translateZ(60px)" }}>
        {/* Top: Branding */}
        <div className="flex justify-between items-start">
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-3">
                <span className="text-[11px] font-black text-white px-4 py-1.5 bg-white/5 border border-white/20 rounded-[1rem] tracking-[0.5em] uppercase shadow-[0_4px_20px_rgba(255,255,255,0.1)]">
                   PRIME
                </span>
                <span className="text-xl text-amber-500 drop-shadow-[0_0_10px_orange] opacity-80 animate-pulse">✦</span>
            </div>
            <h2 className="text-4xl font-black italic tracking-tighter text-white uppercase opacity-95">
               {displayName}
            </h2>
          </div>

          <div className="relative w-16 h-16 group/avatar">
             <div className="absolute inset-0 bg-white/20 rounded-2xl blur-lg opacity-0 group-hover:opacity-100 transition-opacity" />
             <div className="w-full h-full rounded-2xl border border-white/20 bg-black/60 backdrop-blur-md overflow-hidden p-1 shadow-2xl relative z-10">
                {avatarUrl ? (
                    <img src={avatarUrl} alt={displayName} className="w-full h-full object-cover rounded-xl brightness-110 contrast-125" />
                ) : (
                    <div className="w-full h-full flex items-center justify-center text-3xl saturate-0">⚜️</div>
                )}
             </div>
          </div>
        </div>

        {/* Center: Lux Verdict */}
        <div className="space-y-4 text-center px-4">
           <div className="h-[1px] w-full bg-gradient-to-r from-transparent via-amber-200/20 to-transparent" />
           <div className="flex flex-col gap-1.5">
             <p className="text-[12px] font-black text-white uppercase tracking-tight leading-tight italic">
               «Экземпляр, с которого начинается отсчёт.»
             </p>
             <p className="text-[9px] font-bold text-amber-400/40 uppercase tracking-widest leading-relaxed">
               Редкость: не дропается. Оригинал.
             </p>
           </div>
           <div className="h-[1px] w-full bg-gradient-to-r from-transparent via-amber-200/20 to-transparent" />
        </div>

        {/* Bottom */}
        <div className="space-y-8">
          <div className="flex justify-between items-end">
            <div className="flex flex-col gap-1">
               <span className="text-[9px] font-black text-white/20 uppercase tracking-[0.5em] mb-1">Первичный код</span>
               <div className="flex items-baseline gap-2">
                  <span className="text-6xl font-black italic tracking-tighter text-white drop-shadow-[0_0_20px_rgba(255,255,255,0.3)]">001</span>
               </div>
            </div>
            
            <div className="flex flex-col items-end gap-3 pb-2">
               <div className="flex flex-col items-end opacity-60">
                 <span className="text-[8px] font-black text-amber-400/40 tracking-[0.3em] uppercase">Derivation Check</span>
                 <span className="text-[14px] font-black italic text-white uppercase tracking-tighter">SOURCE_MOD</span>
               </div>
               <div className="flex gap-[4px]">
                   {[1,2,3,4].map(i => (
                     <div key={i} className="w-2 h-2 border border-amber-500/30 rounded-full bg-amber-500/5 shadow-[0_0_5px_rgba(255,191,0,0.2)]" />
                   ))}
               </div>
            </div>
          </div>

          <button className="w-full py-6 rounded-[2rem] bg-white text-black font-black text-[12px] uppercase tracking-[0.8em] transition-all duration-300 hover:bg-amber-50 hover:tracking-[1em] active:scale-95 shadow-[0_35px_70px_-15px_rgba(255,255,255,0.2)] border-b-[4px] border-zinc-300">
             INITIALIZE
          </button>
        </div>
      </div>
    </motion.div>
  );
}
