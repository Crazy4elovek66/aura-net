"use client";

import { motion, useMotionValue, useSpring, useTransform } from "framer-motion";
import { useEffect, useState } from "react";

interface CreatorCardProps {
  username: string;
  displayName: string;
  avatarUrl: string | null;
}

export default function CreatorCardV8({
  username,
  displayName,
  avatarUrl,
}: CreatorCardProps) {
  const mouseX = useSpring(useMotionValue(0), { stiffness: 120, damping: 35 });
  const mouseY = useSpring(useMotionValue(0), { stiffness: 120, damping: 35 });

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
      className="relative w-full max-w-[360px] aspect-[9/13] rounded-[3rem] p-10 flex flex-col justify-between overflow-hidden group select-none bg-[#020202] shadow-[0_45px_100px_rgba(0,0,0,1)] border border-white/[0.03]"
    >
      {/* 1. Шёлковые нити (Celestial Silk Layers) */}
      <div className="absolute inset-x-[-20%] inset-y-[-20%] z-0 pointer-events-none overflow-hidden opacity-60">
        {[...Array(6)].map((_, i) => (
          <motion.div
            key={i}
            animate={{
              x: [0, 60, -60, 0],
              y: [0, -40, 40, 0],
              rotate: [0, 45, -45, 0],
              scale: [1, 1.1, 0.9, 1],
            }}
            transition={{
              duration: 12 + i * 4,
              repeat: Infinity,
              ease: "easeInOut",
              delay: i * 2,
            }}
            style={{
                x: useTransform(mouseX, [-300, 300], [-20 * (i+1), 20 * (i+1)]),
                y: useTransform(mouseY, [-300, 300], [-10 * (i+1), 10 * (i+1)]),
                filter: "blur(40px)",
                background: `radial-gradient(ellipse at center, ${i % 2 === 0 ? "rgba(168,85,247,0.15)" : "rgba(255,255,255,0.08)"} 0%, transparent 70%)`
            }}
            className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[200%] h-[15px] skew-x-[-30deg]"
          />
        ))}
        {/* Дополнительный слой медленного тумана */}
        <div className="absolute inset-0 bg-gradient-to-br from-purple-500/5 via-transparent to-white/5 animate-pulse-slow" />
      </div>

      {/* 2. Тонкие светящиеся линии (Flowing Ribbons) */}
      <div className="absolute inset-0 z-5 pointer-events-none opacity-20">
         {[...Array(3)].map((_, i) => (
             <motion.div 
                key={i}
                animate={{ x: ["-100%", "200%"] }}
                transition={{ duration: 10 + i * 5, repeat: Infinity, ease: "linear", delay: i * 3 }}
                className="absolute top-[20%] w-[1px] h-full bg-gradient-to-b from-transparent via-white to-transparent rotate-45 blur-[1px]"
             />
         ))}
      </div>

      {/* 3. Отражение на стекле (Nano Reflection) */}
      <motion.div 
        style={{
          x: useTransform(mouseX, [-400, 400], [150, -150]),
          y: useTransform(mouseY, [-400, 400], [150, -150]),
        }}
        className="absolute inset-[15%] z-10 pointer-events-none border-[1px] border-white/5 rounded-[2.5rem] bg-gradient-to-tr from-white/[0.02] via-transparent to-white/[0.05]"
      />

      {/* Content */}
      <div className="relative z-20 flex flex-col h-full justify-between" style={{ transform: "translateZ(50px)" }}>
        {/* Top */}
        <div className="space-y-4">
          <div className="flex justify-between items-center">
             <div className="flex items-center gap-2">
                <span className="text-[10px] font-black text-white px-3 py-1 bg-white/5 rounded-full border border-white/10 tracking-[0.3em] uppercase">
                   GOLD SEED
                </span>
             </div>
             <div className="w-8 h-[1px] bg-white/20" />
          </div>
          
          <div className="space-y-1">
             <h2 className="text-4xl font-black italic tracking-tighter text-white uppercase drop-shadow-[0_0_15px_rgba(255,255,255,0.3)]">
                {displayName}
             </h2>
             <p className="text-[10px] font-bold text-white/30 uppercase tracking-[0.5em]">@system_root</p>
          </div>
        </div>

        {/* Center: Silk Quote */}
        <div className="relative py-12">
            <motion.div 
               animate={{ opacity: [0.4, 0.8, 0.4] }}
               transition={{ duration: 5, repeat: Infinity }}
               className="text-center font-medium text-white/60 text-[13px] leading-relaxed uppercase tracking-widest italic"
            >
               "Weaving the threads of destiny into the fabric of space."
            </motion.div>
        </div>

        {/* Bottom */}
        <div className="space-y-8">
          <div className="flex justify-between items-center">
             <div className="flex flex-col gap-1">
                <span className="text-[9px] font-black text-white/20 uppercase tracking-[0.4em]">Stardust Magnitude</span>
                <span className="text-5xl font-black italic text-white drop-shadow-[0_0_10px_white]">∞</span>
             </div>
             
             <div className="flex flex-col items-end gap-2">
                <div className="relative w-14 h-14 rounded-2xl border border-white/10 bg-black/40 backdrop-blur-md overflow-hidden p-1 shadow-2xl">
                   {avatarUrl ? (
                       <img src={avatarUrl} alt={displayName} className="w-full h-full object-cover rounded-xl" />
                   ) : (
                       <div className="w-full h-full flex items-center justify-center text-3xl">✨</div>
                   )}
                </div>
                <span className="text-[8px] font-black text-white/10 uppercase tracking-[0.5em]">Origin ID_001</span>
             </div>
          </div>

          <button className="w-full py-6 rounded-full bg-white text-black font-black text-[11px] uppercase tracking-[0.6em] transition-all duration-500 hover:bg-neutral-200 active:scale-95 shadow-[0_25px_50px_-10px_rgba(255,255,255,0.1)]">
             ВСТУПИТЬ
          </button>
        </div>
      </div>

      <style jsx>{`
        @keyframes pulse-slow {
          0%, 100% { opacity: 0.1; }
          50% { opacity: 0.2; }
        }
        .animate-pulse-slow {
          animation: pulse-slow 8s ease-in-out infinite;
        }
      `}</style>
    </motion.div>
  );
}
