"use client";

import { motion, useMotionValue, useSpring, useTransform } from "framer-motion";
import { useEffect, useState } from "react";

interface CreatorCardProps {
  username: string;
  displayName: string;
  avatarUrl: string | null;
}

export default function CreatorCardV12({
  username,
  displayName,
  avatarUrl,
}: CreatorCardProps) {
  const mouseX = useSpring(useMotionValue(0), { stiffness: 100, damping: 30 });
  const mouseY = useSpring(useMotionValue(0), { stiffness: 100, damping: 30 });

  const rotateX = useTransform(mouseY, [-400, 400], [15, -15]);
  const rotateY = useTransform(mouseX, [-400, 400], [-15, 15]);

  // Эффект "Голографической фольги" (спектр)
  const foilX = useTransform(mouseX, [-400, 400], ["0%", "100%"]);
  const foilY = useTransform(mouseY, [-400, 400], ["0%", "100%"]);

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
      className="relative w-full max-w-[360px] aspect-[9/13] rounded-[3.5rem] p-10 flex flex-col justify-between overflow-hidden group select-none bg-black shadow-[0_50px_100px_rgba(0,0,0,1)] border border-white/5"
    >
      {/* 1. Голографический слой (Holographic Foil) */}
      <motion.div 
        style={{
          background: `linear-gradient(135deg, 
            transparent 0%, 
            rgba(255,0,255,0.1) 20%, 
            rgba(0,255,255,0.1) 40%, 
            rgba(255,255,0,0.1) 60%, 
            rgba(255,0,255,0.1) 80%, 
            transparent 100%)`,
          backgroundSize: "400% 400%",
          left: useTransform(mouseX, [-400, 400], ["-100%", "0%"]),
          top: useTransform(mouseY, [-400, 400], ["-100%", "0%"]),
        }}
        className="absolute inset-[-100%] z-0 pointer-events-none opacity-60 mix-blend-color-dodge blur-3xl animate-pulse"
      />

      {/* 2. Радужный перелив (Prism Sweep) - движется вместе с наклоном */}
      <motion.div 
        style={{
          background: `linear-gradient(to right, transparent, rgba(236,72,153,0.3), rgba(6,182,212,0.3), transparent)`,
          x: useTransform(mouseX, [-400, 400], ["-50%", "50%"]),
        }}
        className="absolute inset-0 z-5 pointer-events-none opacity-40 blur-2xl rotate-45 scale-150"
      />

      {/* 3. Глянцевое покрытие (Wet Glass) */}
      <div className="absolute inset-0 z-10 pointer-events-none rounded-[3.5rem] border border-white/10" />
      <motion.div 
        style={{
            background: useTransform(
                mouseX,
                [-400, 400],
                ["radial-gradient(circle at 0% 0%, rgba(255,255,255,0.1) 0%, transparent 50%)", "radial-gradient(circle at 100% 100%, rgba(255,255,255,0.1) 0%, transparent 50%)"]
            )
        }}
        className="absolute inset-0 z-10 pointer-events-none rounded-[3.5rem]"
      />

      {/* Content */}
      <div className="relative z-20 flex flex-col h-full justify-between" style={{ transform: "translateZ(60px)" }}>
        {/* Top: Branding */}
        <div className="flex justify-between items-start">
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2">
                <span className="text-[10px] font-black text-white px-3 py-1 bg-black/40 border border-white/20 rounded-full tracking-[0.4em] uppercase">
                   HOLO-RARE
                </span>
                <span className="w-2 h-2 rounded-full bg-cyan-400 shadow-[0_0_10px_#22d3ee] animate-pulse" />
            </div>
            <h2 className="text-4xl font-black italic tracking-tighter text-white uppercase drop-shadow-[0_0_20px_rgba(255,255,255,0.4)]">
               {displayName}
            </h2>
          </div>

          <div className="relative w-16 h-16 group/avatar">
             <div className="absolute inset-0 bg-gradient-to-br from-pink-500 to-cyan-500 rounded-2xl blur-md opacity-40 group-hover:opacity-80 transition-opacity" />
             <div className="w-full h-full rounded-2xl border border-white/30 bg-black/60 backdrop-blur-md overflow-hidden p-1 shadow-2xl relative z-10">
                {avatarUrl ? (
                    <img src={avatarUrl} alt={displayName} className="w-full h-full object-cover rounded-xl" />
                ) : (
                    <div className="w-full h-full flex items-center justify-center text-3xl drop-shadow-lg grayscale-0">💿</div>
                )}
             </div>
          </div>
        </div>

        {/* Center: Glowing Soul */}
        <div className="text-center py-6 relative overflow-hidden group/text">
           <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent -translate-x-full group-hover/text:translate-x-full transition-transform duration-1000" />
           <p className="text-[13px] font-black italic text-white/90 leading-tight uppercase tracking-widest drop-shadow-lg">
             «Редчайший артефакт в твоей коллекции.»
           </p>
        </div>

        {/* Bottom */}
        <div className="space-y-8">
          <div className="flex justify-between items-end">
            <div className="flex flex-col gap-2">
               <span className="text-[9px] font-black text-white/20 uppercase tracking-[0.5em] mb-1">Rarity Class</span>
               <div className="flex items-baseline gap-2">
                  <span className="text-6xl font-black italic tracking-tighter text-transparent bg-clip-text bg-gradient-to-br from-white via-cyan-300 to-pink-300 drop-shadow-2xl">S+</span>
                  <div className="w-2 h-2 rounded-full bg-pink-500 mb-2" />
               </div>
            </div>
            
            <div className="flex flex-col items-end gap-3 pb-2">
               <div className="flex flex-col items-end">
                 <span className="text-[8px] font-black text-white/40 tracking-[0.3em] uppercase">Spectral Resonance</span>
                 <span className="text-[14px] font-black italic text-white/90 uppercase tracking-tighter">MAX_LEVEL</span>
               </div>
               <div className="h-[2px] w-24 bg-white/10 rounded-full overflow-hidden">
                  <motion.div 
                    animate={{ x: ["-100%", "100%"] }}
                    transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                    className="w-full h-full bg-gradient-to-r from-pink-500 via-white to-cyan-500"
                  />
               </div>
            </div>
          </div>

          <button className="w-full py-6 rounded-[2rem] bg-white text-black font-black text-[12px] uppercase tracking-[0.6em] transition-all duration-300 hover:scale-[1.03] active:scale-95 shadow-[0_30px_60px_-10px_rgba(255,255,255,0.2)] border-b-[4px] border-neutral-300">
             АКТИВИРОВАТЬ
          </button>
        </div>
      </div>
    </motion.div>
  );
}
