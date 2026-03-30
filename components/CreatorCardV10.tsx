"use client";

import { motion, useMotionValue, useSpring, useTransform } from "framer-motion";
import { useEffect, useState } from "react";

interface CreatorCardProps {
  username: string;
  displayName: string;
  avatarUrl: string | null;
}

export default function CreatorCardV10({
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
        perspective: 1200,
      }}
      className="relative w-full max-w-[360px] aspect-[9/13] rounded-[3.5rem] p-10 flex flex-col justify-between overflow-hidden group select-none bg-[#050505] shadow-[0_45px_100px_rgba(0,0,0,1)] border border-white/5"
    >
      {/* 1. Жидкий Неон (Liquid Neon Dreamscape) */}
      <div className="absolute inset-0 z-0 pointer-events-none overflow-hidden">
        {/* Розовое пятно */}
        <motion.div 
          animate={{
            x: [0, 80, -80, 0],
            y: [0, -40, 40, 0],
            scale: [1, 1.3, 0.9, 1],
          }}
          transition={{ duration: 18, repeat: Infinity, ease: "easeInOut" }}
          className="absolute -top-1/4 -left-1/4 w-[120%] h-[120%] bg-[radial-gradient(ellipse_at_center,rgba(236,72,153,0.3)_0%,transparent_60%)] blur-[110px]"
        />
        
        {/* Голубое пятно */}
        <motion.div 
          animate={{
            x: [0, -70, 70, 0],
            y: [0, 50, -50, 0],
            scale: [1, 0.8, 1.2, 1],
          }}
          transition={{ duration: 15, repeat: Infinity, ease: "easeInOut", delay: 2 }}
          className="absolute -bottom-1/4 -right-1/4 w-[120%] h-[120%] bg-[radial-gradient(ellipse_at_center,rgba(6,182,212,0.3)_0%,transparent_60%)] blur-[100px]"
        />

        {/* Фиолетовое пятно (следует за мышью) */}
        <motion.div 
          style={{
            x: useTransform(mouseX, [-300, 300], [-80, 80]),
            y: useTransform(mouseY, [-300, 300], [-80, 80]),
          }}
          className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(168,85,247,0.25)_0%,transparent_50%)] blur-[120px] opacity-60 group-hover:opacity-100 transition-opacity"
        />
        
        {/* Пыль */}
        <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-[0.1] contrast-125 mix-blend-overlay" />
      </div>

      {/* 2. Статичная неоновая рамка (Neon Pulse Frame) */}
      <div className="absolute inset-0 z-10 rounded-[3.5rem] border border-white/10" />
      <div className="absolute inset-0 z-10 pointer-events-none rounded-[3.5rem] shadow-[inset_0_0_20px_rgba(168,85,247,0.1),0_0_15px_rgba(236,72,153,0.1)] border-[1px] border-white/5" />

      {/* Content */}
      <div className="relative z-20 flex flex-col h-full justify-between" style={{ transform: "translateZ(50px)" }}>
        {/* Top */}
        <div className="flex justify-between items-start">
          <div className="flex flex-col gap-2">
            <span className="w-fit px-3 py-1 rounded-full bg-white/5 border border-white/10 text-[9px] font-black uppercase tracking-[0.4em] text-white/50">
              DREAMSCAPE
            </span>
            <h2 className="text-4xl font-black italic tracking-tighter text-white uppercase drop-shadow-[0_0_20px_rgba(255,255,255,0.3)]">
              {displayName}
            </h2>
          </div>

          <div className="relative w-16 h-16 group/avatar">
             <div className="absolute inset-x-[-10px] bottom-0 h-[2px] bg-gradient-to-r from-transparent via-pink-500 to-transparent blur-sm animate-pulse" />
             <div className="w-full h-full rounded-2xl border border-white/20 bg-black/40 backdrop-blur-md overflow-hidden p-1 shadow-2xl">
                {avatarUrl ? (
                    <img src={avatarUrl} alt={displayName} className="w-full h-full object-cover rounded-xl" />
                ) : (
                    <div className="w-full h-full flex items-center justify-center text-3xl">🧩</div>
                )}
             </div>
          </div>
        </div>

        {/* Center: Vibe */}
        <div className="text-center py-6">
           <p className="text-[14px] font-medium text-white/80 italic leading-snug uppercase tracking-tight">
             «Ты создаешь свою ауру сам. Выбирай яркие цвета.»
           </p>
           <div className="w-8 h-[1px] bg-white/10 mx-auto mt-4" />
        </div>

        {/* Bottom */}
        <div className="space-y-8">
          <div className="flex justify-between items-end">
            <div className="flex flex-col gap-1">
              <span className="text-[10px] font-black text-white/20 uppercase tracking-[0.5em] mb-1">Soul Potential</span>
              <div className="flex items-baseline gap-1">
                <span className="text-6xl font-black italic tracking-tighter text-white drop-shadow-[0_0_15px_white]">
                  ∞ 
                </span>
                <span className="text-[10px] font-black text-white/10 uppercase mb-2">pts</span>
              </div>
            </div>
            
            <div className="flex flex-col items-end gap-2 pb-2">
               <div className="px-4 py-1.5 rounded-full bg-black/40 border border-white/10 backdrop-blur-xl">
                  <span className="text-[9px] font-black text-white/60 tracking-[0.2em] uppercase italic">Aura Admin</span>
               </div>
               <div className="flex gap-[3px]">
                   {[1,2,3,4,5].map(i => (
                     <div key={i} className="w-2 h-2 rounded-full border border-white/20 bg-white/5" />
                   ))}
               </div>
            </div>
          </div>

          <button className="w-full py-6 rounded-[2rem] bg-white text-black font-black text-[12px] uppercase tracking-[0.6em] transition-all duration-500 hover:tracking-[0.8em] active:scale-95 shadow-[0_30px_60px_-15px_rgba(255,255,255,0.2)]">
             ВОЙТИ В МИР
          </button>
        </div>
      </div>
    </motion.div>
  );
}
