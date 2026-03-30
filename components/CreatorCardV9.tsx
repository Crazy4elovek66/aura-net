"use client";

import { motion, useMotionValue, useSpring, useTransform } from "framer-motion";
import { useEffect, useState } from "react";

interface CreatorCardProps {
  username: string;
  displayName: string;
  avatarUrl: string | null;
}

export default function CreatorCardV9({
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
        perspective: 1000,
      }}
      className="relative w-full max-w-[360px] aspect-[9/13] rounded-[3.5rem] p-10 flex flex-col justify-between overflow-hidden group select-none bg-black shadow-[0_0_80px_rgba(255,0,255,0.1)] border border-white/5"
    >
      {/* 1. Живой Неон (Neon Genesis Flows) */}
      <div className="absolute inset-x-[-20%] inset-y-[-20%] z-0 pointer-events-none overflow-hidden opacity-80">
        <div className="absolute inset-0 bg-black/40 z-10" />
        
        {/* Розовая лента */}
        <motion.div 
          animate={{
            x: [0, 40, -40, 0],
            y: [0, -60, 60, 0],
            scale: [1, 1.2, 0.8, 1],
          }}
          transition={{ duration: 15, repeat: Infinity, ease: "easeInOut" }}
          className="absolute -top-1/4 -left-1/4 w-[120%] h-[120%] bg-[radial-gradient(ellipse_at_center,rgba(236,72,153,0.4)_0%,transparent_60%)] blur-[100px]"
        />
        
        {/* Голубая лента */}
        <motion.div 
          animate={{
            x: [0, -60, 60, 0],
            y: [0, 40, -40, 0],
            scale: [1, 0.8, 1.2, 1],
          }}
          transition={{ duration: 12, repeat: Infinity, ease: "easeInOut", delay: 2 }}
          className="absolute -bottom-1/4 -right-1/4 w-[120%] h-[120%] bg-[radial-gradient(ellipse_at_center,rgba(6,182,212,0.4)_0%,transparent_60%)] blur-[90px]"
        />

        {/* Фиолетовый блик под мышкой */}
        <motion.div 
          style={{
            x: useTransform(mouseX, [-300, 300], [-100, 100]),
            y: useTransform(mouseY, [-300, 300], [-100, 100]),
          }}
          className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(168,85,247,0.3)_0%,transparent_50%)] blur-[120px] transition-opacity duration-500 opacity-60 group-hover:opacity-100"
        />
      </div>

      {/* 2. Тонкие неоновые линии (Cyber Paths) */}
      <div className="absolute inset-0 z-5 pointer-events-none opacity-30">
        <div className="absolute top-0 left-1/4 w-[1px] h-full bg-gradient-to-b from-transparent via-pink-500 to-transparent blur-[1px]" />
        <div className="absolute top-0 right-1/3 w-[1px] h-full bg-gradient-to-b from-transparent via-cyan-500 to-transparent blur-[1px]" />
      </div>

      {/* 3. Горящая рамка (Electric Border) */}
      <div className="absolute inset-0 z-10 rounded-[3.5rem] border border-white/10" />
      <div className="absolute inset-0 z-10 pointer-events-none p-[1.5px] rounded-[3.5rem] overflow-hidden">
        <div className="w-full h-full rounded-[3.5rem] border border-transparent [mask-image:linear-gradient(white,white)_padding-box,linear-gradient(white,white)] [mask-composite:exclude]">
          <motion.div 
            animate={{ rotate: 360 }}
            transition={{ duration: 6, repeat: Infinity, ease: "linear" }}
            className="absolute -inset-1/2 bg-[conic-gradient(from_0deg,transparent_0deg,transparent_320deg,#ec4899_340deg,#06b6d4_360deg)] opacity-60"
          />
        </div>
      </div>

      {/* Content */}
      <div className="relative z-20 flex flex-col h-full justify-between" style={{ transform: "translateZ(70px)" }}>
        {/* Top: Neon Branding */}
        <div className="flex justify-between items-start">
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2">
                <span className="text-[10px] font-black text-white px-3 py-1 bg-black/40 border border-white/20 rounded-md tracking-[0.3em] uppercase sm:tracking-[0.5em]">
                  GENESIS
                </span>
                <span className="w-1.5 h-1.5 rounded-full bg-pink-500 shadow-[0_0_10px_#ec4899]" />
            </div>
            <h2 className="text-4xl font-black italic tracking-tighter text-transparent bg-clip-text bg-gradient-to-br from-white via-white to-white/60 drop-shadow-[0_0_15px_rgba(255,255,255,0.4)]">
              {displayName}
            </h2>
          </div>

          <div className="relative w-16 h-16 rounded-3xl border border-white/20 bg-black/40 backdrop-blur-md p-1 shadow-[0_0_30px_rgba(236,72,153,0.2)] overflow-hidden">
             {avatarUrl ? (
                 <img src={avatarUrl} alt={displayName} className="w-full h-full object-cover rounded-2xl" />
             ) : (
                 <div className="w-full h-full flex items-center justify-center text-3xl">🧬</div>
             )}
          </div>
        </div>

        {/* Center: Cyber Quote */}
        <div className="py-6 border-y border-white/5 bg-white/[0.01]">
            <p className="text-[13px] font-bold text-center text-white/90 italic leading-snug uppercase tracking-tight">
              «Яркий свет неона — это твоя новая реальность.»
            </p>
        </div>

        {/* Bottom */}
        <div className="space-y-6">
          <div className="flex justify-between items-end">
            <div className="flex flex-col gap-2">
              <span className="text-[9px] font-black text-white/40 uppercase tracking-[0.4em]">Energy Magnitude</span>
              <div className="flex items-baseline gap-1">
                <span className="text-6xl font-black italic tracking-tighter text-white">
                  ∞ 
                </span>
              </div>
            </div>
            
            <div className="flex flex-col items-end gap-3 pb-2">
               <div className="flex flex-col items-end">
                 <span className="text-[8px] font-black text-pink-500/80 tracking-[0.3em] uppercase">Reactor Core</span>
                 <span className="text-[14px] font-black italic text-cyan-400">UNSTABLE_GOD</span>
               </div>
               <div className="flex gap-[3px]">
                   {[1,2,3,4,5,6].map(i => (
                     <motion.div 
                        key={i} 
                        animate={{ opacity: [0.3, 1, 0.3], backgroundColor: ["#ec4899", "#06b6d4", "#ec4899"] }}
                        transition={{ duration: 2, repeat: Infinity, delay: i * 0.2 }}
                        className="w-1.5 h-1.5 rounded-full" 
                     />
                   ))}
               </div>
            </div>
          </div>

          <button className="w-full py-5 rounded-[2rem] bg-gradient-to-r from-pink-500 to-cyan-500 text-white font-black text-[12px] uppercase tracking-[0.6em] transition-all duration-500 hover:scale-[1.03] active:scale-95 shadow-[0_20px_40px_rgba(236,72,153,0.3)]">
             ВЗЛОМАТЬ
          </button>
        </div>
      </div>
    </motion.div>
  );
}
