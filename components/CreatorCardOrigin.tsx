"use client";

import { motion, useMotionValue, useSpring, useTransform } from "framer-motion";
import { useEffect, useState } from "react";

interface CreatorCardProps {
  username: string;
  displayName: string;
  avatarUrl: string | null;
}

export default function CreatorCardOrigin({
  username,
  displayName,
  avatarUrl,
}: CreatorCardProps) {
  const mouseX = useSpring(useMotionValue(0), { stiffness: 100, damping: 30 });
  const mouseY = useSpring(useMotionValue(0), { stiffness: 100, damping: 30 });

  const rotateX = useTransform(mouseY, [-400, 400], [6, -6]);
  const rotateY = useTransform(mouseX, [-400, 400], [-6, 6]);

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
        willChange: "transform",
      }}
      className="relative w-full max-w-[360px] aspect-[9/13] rounded-[4rem] p-10 flex flex-col justify-between overflow-hidden group select-none bg-black shadow-[0_45px_100px_rgba(255,255,255,0.06)] border border-white/20 transform-gpu"
    >
      {/* 1. Origin Effects (Soft White + Spectral Lines) */}
      <div className="absolute inset-0 z-0 pointer-events-none">
        <motion.div 
           animate={{
             opacity: [0.25, 0.5, 0.25],
           }}
           transition={{ duration: 8, repeat: Infinity }}
           className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(circle_at_20%_20%,rgba(255,255,255,0.25)_0%,transparent_50%)] blur-[100px]"
        />
        
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_80%_80%,rgba(255,255,255,0.15)_0%,transparent_50%)] blur-[80px]" />

        {/* Spectral Lines (Thin Rainbow) */}
        <motion.div 
          animate={{ x: ["-100%", "200%"] }}
          transition={{ duration: 15, repeat: Infinity, ease: "linear" }}
          className="absolute inset-y-0 w-[2px] bg-gradient-to-b from-transparent via-cyan-500/30 to-transparent rotate-[20deg] blur-[1px]"
        />
        <motion.div 
          animate={{ x: ["200%", "-100%"] }}
          transition={{ duration: 12, repeat: Infinity, ease: "linear" }}
          className="absolute inset-y-0 w-[2px] bg-gradient-to-b from-transparent via-pink-500/30 to-transparent rotate-[-20deg] blur-[1px]"
        />
      </div>

      {/* 2. Atmospheric Border */}
      <div className="absolute inset-x-6 inset-y-6 z-10 pointer-events-none rounded-[3.5rem] border border-white/10" />
      <div className="absolute inset-0 z-10 pointer-events-none rounded-[4rem] shadow-[inset_0_0_100px_rgba(255,255,255,0.05)]" />

      {/* Content */}
      <div className="relative z-20 flex flex-col h-full justify-between" style={{ transform: "translateZ(30px)" }}>
        {/* Top: Branding */}
        <div className="flex justify-between items-start">
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-3">
                <span className="text-[10px] font-black text-white/80 px-4 py-1.5 rounded-full border border-white/30 tracking-[0.5em] uppercase bg-white/10 shadow-[0_0_15px_rgba(255,255,255,0.1)]">
                   ORIGIN
                </span>
                <span className="text-xl text-white/60 drop-shadow-[0_0_10px_white] animate-pulse">✦</span>
            </div>
            <h2 className="text-4xl font-black italic tracking-tighter text-white uppercase opacity-90 decoration-white/20 text-shadow-lg">
               {displayName}
            </h2>
          </div>

          <div className="relative w-16 h-16 group/avatar">
             <div className="w-full h-full rounded-full border border-white/30 bg-black/40 backdrop-blur-md overflow-hidden p-1 shadow-2xl relative z-10 scale-95 transition-transform group-hover:scale-100">
                {avatarUrl ? (
                    <img src={avatarUrl} alt={displayName} className="w-full h-full object-cover rounded-full grayscale opacity-90" />
                ) : (
                    <div className="w-full h-full flex items-center justify-center text-4xl opacity-70 contrast-150">⚪</div>
                )}
             </div>
          </div>
        </div>

        {/* Center: Atmospheric Verdict */}
        <div className="space-y-6 text-center px-4">
           <div className="flex flex-col gap-2">
             <p className="text-[12px] font-black text-white uppercase tracking-tight leading-tight italic">
               «До появления рангов уже был здесь.»
             </p>
             <p className="text-[9px] font-bold text-white/40 uppercase tracking-[0.4em] leading-relaxed">
               Источник сигнала. Не копия.
             </p>
           </div>
           <div className="h-[1px] w-24 mx-auto bg-gradient-to-r from-transparent via-white/30 to-transparent" />
        </div>

        {/* Bottom */}
        <div className="space-y-10">
          <div className="flex justify-between items-end">
            <div className="flex flex-col gap-1">
               <span className="text-[9px] font-black text-white/30 uppercase tracking-[0.5em] mb-1">Signal Source</span>
               <div className="flex items-baseline gap-2">
                  <span className="text-6xl font-black italic tracking-tighter text-white drop-shadow-[0_0_20px_rgba(255,255,255,0.4)]">ROOT</span>
               </div>
            </div>
            
            <div className="flex flex-col items-end gap-3 pb-2">
               <div className="flex flex-col items-end opacity-60 group-hover:opacity-90 transition-opacity">
                 <span className="text-[8px] font-black text-white/50 tracking-[0.3em] uppercase">Primary Loop</span>
                 <span className="text-[14px] font-black italic text-white uppercase tracking-tighter">SIG_ALPHA</span>
               </div>
               <div className="flex gap-[6px]">
                   {[1,2,3,4,5].map(i => (
                     <div key={i} className="w-2.5 h-[1.5px] bg-white/30 rounded-full" />
                   ))}
               </div>
            </div>
          </div>

          <button className="w-full py-6 rounded-full bg-white text-black font-black text-[12px] uppercase tracking-[1em] transition-all duration-500 hover:tracking-[1.2em] active:scale-95 shadow-[0_0_60px_rgba(255,255,255,0.2)]">
             RETRIEVE
          </button>
        </div>
      </div>
    </motion.div>
  );
}
