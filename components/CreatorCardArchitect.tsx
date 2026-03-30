"use client";

import { motion, useMotionValue, useSpring, useTransform } from "framer-motion";
import { useEffect, useState } from "react";

interface CreatorCardProps {
  username: string;
  displayName: string;
  avatarUrl: string | null;
}

export default function CreatorCardArchitect({
  username,
  displayName,
  avatarUrl,
}: CreatorCardProps) {
  const mouseX = useSpring(useMotionValue(0), { stiffness: 100, damping: 30 });
  const mouseY = useSpring(useMotionValue(0), { stiffness: 100, damping: 30 });

  const rotateX = useTransform(mouseY, [-400, 400], [5, -5]);
  const rotateY = useTransform(mouseX, [-400, 400], [-5, 5]);

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
      animate={{
        x: [0, -1, 1, -1, 0],
        y: [0, 1, -1, 1, 0],
      }}
      transition={{
        duration: 0.2,
        repeat: Infinity,
        repeatType: "mirror",
        ease: "linear",
        repeatDelay: 2,
      }}
      className="relative w-full max-w-[360px] aspect-[9/13] rounded-[2rem] p-10 flex flex-col justify-between overflow-hidden group select-none bg-[#0a0a0a] shadow-[0_40px_80px_rgba(0,0,0,0.8)] border border-white/5"
    >
      {/* 1. Текстура Обсидиана и Шум */}
      <div className="absolute inset-0 z-0 opacity-40 mix-blend-overlay pointer-events-none bg-[url('https://grainy-gradients.vercel.app/noise.svg')] contrast-150 brightness-50" />
      <div className="absolute inset-0 z-0 bg-gradient-to-t from-black via-transparent to-white/5 opacity-50" />

      {/* 2. RGB Glitch Borders (Chromatic Aberration) */}
      <div className="absolute inset-0 z-10 pointer-events-none">
        <div className="absolute inset-0 border border-red-500/10 -translate-x-[1px] translate-y-[1px] rounded-[2rem]" />
        <div className="absolute inset-0 border border-blue-500/10 translate-x-[1px] -translate-y-[1px] rounded-[2rem]" />
        <div className="absolute inset-0 border border-green-500/10 translate-x-[2px] rounded-[2rem]" />
      </div>

      {/* 3. Хроматические полосы (Glitch Lines) */}
      <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 z-5 opacity-20 group-hover:opacity-40 transition-opacity">
        <motion.div 
           animate={{ y: [-20, 20, -20] }}
           transition={{ duration: 4, repeat: Infinity, ease: "linear" }}
           className="h-[1px] w-full bg-red-500 blur-[0.5px]" 
        />
        <motion.div 
           animate={{ y: [20, -20, 20] }}
           transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
           className="h-[1px] w-full bg-blue-500 shadow-[0_0_10px_blue] blur-[0.5px]" 
        />
      </div>

      {/* Content */}
      <div className="relative z-20 flex flex-col h-full justify-between" style={{ transform: "translateZ(40px)" }}>
        {/* Top */}
        <div className="flex justify-between items-start">
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-2">
                <span className="text-[12px] font-black text-white/40 tracking-[0.5em] uppercase">
                   ARCHITECT
                </span>
                <span className="text-xl text-white/60">√</span>
            </div>
            <h2 className="text-4xl font-black italic tracking-tighter text-white uppercase group-hover:text-transparent group-hover:bg-clip-text group-hover:bg-gradient-to-r group-hover:from-red-500 group-hover:via-white group-hover:to-blue-500 transition-all duration-300">
              {displayName}
            </h2>
          </div>

          <div className="w-16 h-16 rounded-xl border border-white/10 bg-black/80 backdrop-blur-sm overflow-hidden p-1 grayscale group-hover:grayscale-0 transition-all shadow-2xl">
              {avatarUrl ? (
                  <img src={avatarUrl} alt={displayName} className="w-full h-full object-cover rounded-lg" />
              ) : (
                  <div className="w-full h-full flex items-center justify-center text-4xl">∞</div>
              )}
          </div>
        </div>

        {/* Oracle Verdict */}
        <div className="space-y-4">
           <div className="h-[1px] w-full bg-gradient-to-r from-transparent via-white/10 to-transparent" />
           <p className="text-[11px] font-mono text-center text-white/50 leading-relaxed uppercase tracking-tighter px-4">
             «Тот, кто написал правила твоего вайба. Не пытайся его забанить - он и есть бан.»
           </p>
           <div className="h-[1px] w-full bg-gradient-to-r from-transparent via-white/10 to-transparent" />
        </div>

        {/* Bottom */}
        <div className="space-y-8">
          <div className="flex justify-between items-end">
            <div className="flex flex-col gap-1">
              <span className="text-[9px] font-black text-white/20 uppercase tracking-[0.4em]">Root Access</span>
              <div className="flex items-baseline gap-1">
                <span className="text-6xl font-black italic tracking-tighter text-white">
                  ROOT
                </span>
              </div>
            </div>
            
            <div className="flex flex-col items-end gap-2 pb-2">
               <span className="text-[10px] font-mono text-white/30 uppercase">System Integrity</span>
               <div className="flex gap-1">
                   {[1,2,3,4,5,6,7].map(i => (
                     <div key={i} className="w-1.5 h-3 bg-white/10 rounded-sm" />
                   ))}
               </div>
            </div>
          </div>

          <button className="w-full py-6 rounded-2xl bg-white text-black font-black text-[12px] uppercase tracking-[0.5em] transition-all duration-300 hover:bg-neutral-200 hover:tracking-[0.7em] active:scale-95 shadow-[0_30px_60px_-10px_rgba(0,0,0,0.5)]">
             CONSOLE
          </button>
        </div>
      </div>
    </motion.div>
  );
}
