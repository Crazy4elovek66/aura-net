"use client";

import { motion, useMotionValue, useSpring, useTransform } from "framer-motion";
import { useEffect, useState } from "react";

interface CreatorCardProps {
  username: string;
  displayName: string;
  avatarUrl: string | null;
}

export default function CreatorCardV6({
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
      className="relative w-full max-w-[360px] aspect-[9/13] rounded-[3.5rem] p-10 flex flex-col justify-between overflow-hidden group select-none bg-black shadow-[0_40px_100px_rgba(0,0,0,0.9)] border border-white/5"
    >
      {/* 1. Центральное Ядро (Stellar Core) */}
      <div className="absolute inset-0 z-0 overflow-hidden">
        <motion.div 
          animate={{
            scale: [1, 1.2, 1],
            opacity: [0.3, 0.6, 0.3],
          }}
          transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 bg-white/20 rounded-full blur-[80px]"
        />
        
        {/* Кольца энергии */}
        <motion.div 
          animate={{ rotate: 360 }}
          transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[150%] h-[150%] bg-[conic-gradient(from_0deg,transparent,rgba(168,85,247,0.1),transparent)] opacity-40 blur-3xl"
        />
      </div>

      {/* 2. Кинетические Фтоны (Kinetic Particles) */}
      <div className="absolute inset-0 z-5 pointer-events-none">
        {[...Array(15)].map((_, i) => (
          <motion.div
            key={i}
            initial={{ 
              x: "50%", 
              y: "50%",
              opacity: 0,
              scale: 0
            }}
            animate={{ 
              x: ["50%", `${Math.random() * 200 - 50}%`],
              y: ["50%", `${Math.random() * 200 - 50}%`],
              opacity: [0, 0.8, 0],
              scale: [0, 1, 0]
            }}
            transition={{ 
              duration: 2 + Math.random() * 3, 
              repeat: Infinity,
              delay: i * 0.4,
              ease: "easeOut"
            }}
            className="absolute w-1 h-3 bg-white rounded-full blur-[1px]"
          />
        ))}
      </div>

      {/* 3. Окантовка (Reactive Border) */}
      <div className="absolute inset-0 z-10 rounded-[3.5rem] border border-white/10" />
      <motion.div 
        style={{
          background: useTransform(
            mouseX,
            [-200, 200],
            ["radial-gradient(circle at 0% 0%, rgba(255,255,255,0.1) 0%, transparent 50%)", "radial-gradient(circle at 100% 100%, rgba(255,255,255,0.1) 0%, transparent 50%)"]
          )
        }}
        className="absolute inset-0 z-10 pointer-events-none rounded-[3.5rem]"
      />

      {/* Content */}
      <div className="relative z-20 flex flex-col h-full justify-between" style={{ transform: "translateZ(60px)" }}>
        {/* Top */}
        <div className="flex justify-between items-start">
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2">
                <span className="text-[10px] font-black text-black px-2 py-0.5 bg-white rounded-[4px] tracking-widest uppercase shadow-[0_0_15px_white]">
                  STELLAR
                </span>
                <div className="w-1.5 h-1.5 rounded-full bg-white animate-ping" />
            </div>
            <h2 className="text-4xl font-black italic tracking-tighter text-white">
              {displayName}
            </h2>
          </div>

          <div className="relative w-16 h-16">
             <div className="absolute inset-x-0 bottom-0 h-[2px] bg-white opacity-50 blur-sm" />
             <div className="w-full h-full rounded-2xl border border-white/20 bg-black/40 backdrop-blur-md overflow-hidden p-1">
                {avatarUrl ? (
                    <img src={avatarUrl} alt={displayName} className="w-full h-full object-cover rounded-xl" />
                ) : (
                    <div className="w-full h-full flex items-center justify-center text-4xl grayscale">⭐</div>
                )}
             </div>
          </div>
        </div>

        {/* Status */}
        <div className="flex flex-col items-center gap-6">
           <div className="flex items-center gap-4 w-full">
              <div className="h-[1px] flex-1 bg-gradient-to-r from-transparent to-white/20" />
              <span className="text-[9px] font-black uppercase tracking-[0.6em] text-white/40">CORE STATUS</span>
              <div className="h-[1px] flex-1 bg-gradient-to-l from-transparent to-white/20" />
           </div>
           <p className="text-xs font-bold text-center text-white/60 leading-relaxed max-w-[200px] uppercase tracking-tighter">
             Active Gravitational Singularity • ID_882
           </p>
        </div>

        {/* Bottom */}
        <div className="space-y-8">
          <div className="flex justify-between items-end">
            <div className="flex flex-col">
              <span className="text-[10px] font-black text-white/20 uppercase tracking-[0.5em] mb-2">Mass Potential</span>
              <div className="flex items-baseline gap-1">
                <span className="text-6xl font-black italic tracking-tighter text-white">
                  ∞ 
                </span>
              </div>
            </div>
            
            <div className="flex flex-col items-end gap-3 pb-2">
               <div className="flex flex-col items-end">
                 <span className="text-[8px] font-black text-white/30 tracking-[0.3em] uppercase">Reactor Load</span>
                 <span className="text-[14px] font-black italic text-white/90">MAX_STABLE</span>
               </div>
               <div className="flex gap-[2px]">
                   {[1,2,3,4,5,6,7].map(i => (
                     <div key={i} className="w-1 h-3 bg-white/20 rounded-full" />
                   ))}
               </div>
            </div>
          </div>

          <button className="w-full py-6 rounded-3xl bg-white text-black font-black text-[12px] uppercase tracking-[0.6em] hover:scale-[1.02] transition-all active:scale-95 shadow-[0_30px_60px_-10px_rgba(255,255,255,0.2)]">
             SYNCHRONIZE
          </button>
        </div>
      </div>
    </motion.div>
  );
}
