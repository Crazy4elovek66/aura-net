"use client";

import { motion, useMotionValue, useSpring, useTransform } from "framer-motion";
import { useEffect, useState } from "react";

interface CreatorCardProps {
  username: string;
  displayName: string;
  avatarUrl: string | null;
}

export default function CreatorCardRoot({
  username,
  displayName,
  avatarUrl,
}: CreatorCardProps) {
  const mouseX = useSpring(useMotionValue(0), { stiffness: 100, damping: 30 });
  const mouseY = useSpring(useMotionValue(0), { stiffness: 100, damping: 30 });

  const rotateX = useTransform(mouseY, [-400, 400], [10, -10]);
  const rotateY = useTransform(mouseX, [-400, 400], [-10, 10]);

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
        perspective: 1200,
        willChange: "transform",
      }}
      className="relative w-full max-w-[360px] aspect-[9/13] rounded-[2.5rem] p-10 flex flex-col justify-between overflow-hidden group select-none bg-[#080000] shadow-[0_45px_100px_rgba(0,0,0,1)] border border-red-900/40 transform-gpu"
    >
      {/* 1. Root Effects (Dark Red/Bordeaux Glow) */}
      <div className="absolute inset-0 z-0 pointer-events-none">
        <motion.div 
           animate={{
             opacity: [0.4, 0.7, 0.4],
             scale: [1, 1.2, 1],
           }}
           transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }}
           className="absolute -bottom-1/4 -right-1/4 w-[120%] h-[120%] bg-[radial-gradient(circle_at_center,rgba(220,38,38,0.35)_0%,transparent_60%)] blur-[90px]"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-red-600/15 via-transparent to-transparent opacity-80" />
        
        {/* Terminal Scanline */}
        <motion.div 
           animate={{ y: ["-100%", "200%"] }}
           transition={{ duration: 8, repeat: Infinity, ease: "linear" }}
           className="absolute inset-x-0 h-[80px] bg-gradient-to-b from-transparent via-red-500/5 to-transparent z-1 opacity-40"
        />
      </div>

      {/* 2. Strict Border */}
      <div className="absolute inset-0 z-10 pointer-events-none rounded-[2.5rem] border border-red-500/10" />
      <div className="absolute inset-0 z-10 pointer-events-none rounded-[2.5rem] shadow-[inset_0_30px_60px_rgba(255,0,0,0.05)]" />

      {/* Content */}
      <div className="relative z-20 flex flex-col h-full justify-between" style={{ transform: "translateZ(80px)" }}>
        {/* Top: Branding */}
        <div className="flex justify-between items-start">
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-3">
                <span className="text-[12px] font-black text-red-100 px-4 py-1 bg-red-950 border border-red-800 rounded-sm tracking-[0.6em] uppercase shadow-[0_0_20px_rgba(153,27,27,0.5)]">
                   ROOT
                </span>
                <span className="text-xl text-red-500 animate-pulse font-mono tracking-tighter">&gt;_</span>
            </div>
            <h2 className="text-4xl font-black italic tracking-tighter text-white uppercase drop-shadow-[0_0_15px_rgba(153,27,27,0.8)] opacity-90">
               {displayName}
            </h2>
          </div>

          <div className="relative w-16 h-16 group/avatar">
             <div className="absolute inset-0 bg-red-600 rounded-2xl blur-md opacity-20 group-hover:opacity-60 transition-opacity" />
             <div className="w-full h-full rounded-2xl border border-red-900/40 bg-black/80 backdrop-blur-md overflow-hidden p-1 shadow-2xl relative z-10">
                {avatarUrl ? (
                    <img src={avatarUrl} alt={displayName} className="w-full h-full object-cover rounded-xl grayscale brightness-75 contrast-125" />
                ) : (
                    <div className="w-full h-full flex items-center justify-center text-4xl opacity-90 drop-shadow-[0_0_10px_red]">👑</div>
                )}
             </div>
          </div>
        </div>

        {/* Center: Systemic Verdict */}
        <div className="space-y-4 text-center px-2">
           <div className="h-[1px] w-full bg-gradient-to-r from-transparent via-red-900/50 to-transparent shadow-[0_0_15px_red]" />
           <div className="flex flex-col gap-2">
             <p className="text-[11px] font-black text-white/90 uppercase tracking-tight leading-tight italic">
               «Полный доступ. Нулевой уровень терпимости к хаосу.»
             </p>
             <p className="text-[9px] font-bold text-red-500/60 uppercase tracking-widest leading-relaxed font-mono">
               Системные ограничения не применяются.
             </p>
           </div>
           <div className="h-[1px] w-full bg-gradient-to-r from-transparent via-red-900/50 to-transparent shadow-[0_0_15px_red]" />
        </div>

        {/* Bottom */}
        <div className="space-y-8">
          <div className="flex justify-between items-end">
            <div className="flex flex-col gap-1">
               <span className="text-[9px] font-black text-red-900 uppercase tracking-[0.5em] mb-1">Привилегии</span>
               <div className="flex items-baseline gap-2">
                  <span className="text-6xl font-black italic tracking-tighter text-white drop-shadow-[0_0_20px_rgba(153,27,27,1)]">MAX</span>
               </div>
            </div>
            
            <div className="flex flex-col items-end gap-3 pb-2">
               <div className="flex flex-col items-end opacity-80">
                 <span className="text-[8px] font-black text-red-500/40 tracking-[0.3em] uppercase">Security Clearance</span>
                 <span className="text-[14px] font-black italic text-red-500 uppercase tracking-tighter font-mono">LEVEL_10</span>
               </div>
               <div className="flex gap-[3px]">
                   {[1,2,3,4,5,6].map(i => (
                     <div key={i} className="w-4 h-1 bg-red-950 border border-red-500/20 rounded-full" />
                   ))}
               </div>
            </div>
          </div>

          <button className="w-full py-6 rounded-2xl bg-red-600 text-white font-black text-[12px] uppercase tracking-[0.8em] transition-all duration-300 hover:bg-black hover:text-red-500 hover:border-red-600 border border-transparent active:scale-95 shadow-[0_25px_50px_-12px_rgba(220,38,38,0.5)]">
             ROOT ACCESS
          </button>
        </div>
      </div>
    </motion.div>
  );
}
