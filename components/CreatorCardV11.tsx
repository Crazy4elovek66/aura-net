"use client";

import { motion, useMotionValue, useSpring, useTransform } from "framer-motion";
import { useEffect, useState } from "react";

interface CreatorCardProps {
  username: string;
  displayName: string;
  avatarUrl: string | null;
}

export default function CreatorCardV11({
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
        perspective: 1200,
      }}
      className="relative w-full max-w-[360px] aspect-[9/13] rounded-[4rem] p-10 flex flex-col justify-between overflow-hidden group select-none bg-black shadow-[0_60px_120px_rgba(0,0,0,1)] border border-white/5"
    >
      {/* 1. Стеклянные осколки (Prismatic Glass Shards) */}
      <div className="absolute inset-0 z-0 pointer-events-none">
        {[...Array(8)].map((_, i) => (
          <motion.div
            key={i}
            animate={{
              x: [0, Math.random() * 40 - 20, 0],
              y: [0, Math.random() * 40 - 20, 0],
              rotate: [0, Math.random() * 20 - 10, 0],
            }}
            transition={{
              duration: 10 + Math.random() * 10,
              repeat: Infinity,
              ease: "easeInOut",
            }}
            style={{
                x: useTransform(mouseX, [-300, 300], [Math.random() * -50, Math.random() * 50]),
                y: useTransform(mouseY, [-300, 300], [Math.random() * -50, Math.random() * 50]),
                width: `${100 + Math.random() * 100}%`,
                height: `${20 + Math.random() * 40}%`,
                top: `${i * 15}%`,
                left: "-50%",
                background: `linear-gradient(90deg, transparent, ${i % 2 === 0 ? "rgba(236,72,153,0.05)" : "rgba(6,182,212,0.05)"}, transparent)`,
                borderTop: "1px solid rgba(255,255,255,0.03)",
                borderBottom: "1px solid rgba(255,255,255,0.03)",
                backdropFilter: "blur(8px)",
                skewY: "-15deg",
            }}
            className="absolute origin-center"
          />
        ))}

        {/* Яркие неоновые преломления */}
        <motion.div 
           animate={{ opacity: [0.2, 0.5, 0.2] }}
           transition={{ duration: 4, repeat: Infinity }}
           className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(circle_at_20%_30%,rgba(236,72,153,0.2),transparent_50%),radial-gradient(circle_at_80%_70%,rgba(6,182,212,0.2),transparent_50%)] blur-[80px]"
        />
      </div>

      {/* 2. Рама с эффектом кристалла */}
      <div className="absolute inset-0 z-10 rounded-[4rem] border border-white/10" />
      <div className="absolute inset-0 z-10 pointer-events-none rounded-[4rem] border-[2px] border-transparent [mask-image:linear-gradient(white,white)_padding-box,linear-gradient(white,white)] [mask-composite:exclude] bg-gradient-to-br from-white/20 via-transparent to-white/20 scale-[0.99]" />

      {/* Content */}
      <div className="relative z-20 flex flex-col h-full justify-between" style={{ transform: "translateZ(80px)" }}>
        {/* Top */}
        <div className="flex justify-between items-start">
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-3">
                <span className="text-[10px] font-black text-white px-3 py-0.5 bg-white/10 rounded-sm skew-x-[-15deg] tracking-widest uppercase border border-white/20 shadow-[0_0_20px_rgba(255,255,255,0.1)]">
                   PRISMATIC
                </span>
                <div className="w-1 h-1 bg-pink-500 animate-ping" />
            </div>
            <h2 className="text-4xl font-black italic tracking-tighter text-white uppercase drop-shadow-[0_10px_20px_rgba(0,0,0,0.5)]">
               {displayName}
            </h2>
          </div>

          <div className="relative w-16 h-16 origin-top-right rotate-[-5deg]">
             <div className="w-full h-full rounded-2xl border border-white/20 bg-black/40 backdrop-blur-md overflow-hidden p-0.5 shadow-2xl">
                {avatarUrl ? (
                    <img src={avatarUrl} alt={displayName} className="w-full h-full object-cover rounded-xl" />
                ) : (
                    <div className="w-full h-full flex items-center justify-center text-3xl saturate-200">💎</div>
                )}
             </div>
          </div>
        </div>

        {/* Center: Faceted Text */}
        <div className="relative flex flex-col items-center gap-4">
           <div className="w-full h-[1px] bg-gradient-to-r from-transparent via-white/20 to-transparent" />
           <p className="text-[15px] font-black italic text-center text-white/90 leading-tight uppercase tracking-[-0.02em] skew-x-[-10deg]">
              «Разбей границы. Создай своё отражение.»
           </p>
           <div className="w-full h-[1px] bg-gradient-to-r from-transparent via-white/20 to-transparent" />
        </div>

        {/* Bottom */}
        <div className="space-y-8">
          <div className="flex justify-between items-end">
            <div className="flex flex-col gap-2">
               <span className="text-[9px] font-black text-white/20 uppercase tracking-[0.5em] mb-1">Shard Frequency</span>
               <div className="flex items-baseline gap-1">
                  <span className="text-6xl font-black italic tracking-tighter text-white">∞</span>
                  <span className="text-[12px] font-bold text-pink-500 uppercase tracking-widest">THz</span>
               </div>
            </div>
            
            <div className="flex flex-col items-end gap-3 pb-2">
               <div className="flex flex-col items-end">
                 <span className="text-[8px] font-black text-white/40 tracking-[0.3em] uppercase">Refraction Level</span>
                 <span className="text-[14px] font-black italic text-cyan-400">ULTRA_MOD</span>
               </div>
               <div className="flex gap-1">
                   {[1,2,3,4,5].map(i => (
                     <div key={i} className="w-4 h-[2px] bg-white/30 rounded-full" />
                   ))}
               </div>
            </div>
          </div>

          <button className="w-full py-6 rounded-2xl bg-white text-black font-black text-[12px] uppercase tracking-[0.8em] transition-all duration-300 hover:scale-[1.02] active:scale-95 shadow-[0_40px_80px_-15px_rgba(255,255,255,0.2)] border-x-[12px] border-black">
             АКТИВАЦИЯ
          </button>
        </div>
      </div>
    </motion.div>
  );
}
