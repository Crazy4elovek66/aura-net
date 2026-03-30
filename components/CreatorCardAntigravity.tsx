"use client";

import { motion, useMotionValue, useSpring, useTransform } from "framer-motion";
import { useEffect, useState } from "react";

interface CreatorCardProps {
  username: string;
  displayName: string;
  avatarUrl: string | null;
}

export default function CreatorCardAntigravity({
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
      }}
      className="relative w-full max-w-[360px] aspect-[9/13] rounded-[3.5rem] p-10 flex flex-col justify-between overflow-hidden group select-none bg-black/40 backdrop-blur-3xl shadow-[0_0_80px_rgba(0,240,255,0.15)] border border-[#00F0FF]/20"
    >
      {/* 1. Внутренняя сетка (Tech Grid) */}
      <div className="absolute inset-0 z-0 pointer-events-none opacity-20">
         <div className="absolute inset-0 bg-[linear-gradient(to_right,#00F0FF_1px,transparent_1px),linear-gradient(to_bottom,#00F0FF_1px,transparent_1px)] bg-[size:30px_30px]" />
         <div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-[#00F0FF]/20 to-transparent" />
      </div>

      {/* 2. Электрический Циан (Electric Cyan Glow) */}
      <motion.div 
         animate={{ opacity: [0.3, 0.6, 0.3] }}
         transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
         className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(circle_at_50%_0%,rgba(0,240,255,0.2),transparent_70%)] blur-[80px]"
      />
      
      {/* Световые лучи */}
      <div className="absolute inset-0 z-5 pointer-events-none opacity-10">
         <div className="absolute top-0 left-[20%] w-[1px] h-full bg-[#00F0FF] rotate-[-20deg] blur-[2px]" />
         <div className="absolute top-0 right-[20%] w-[1px] h-full bg-[#00F0FF] rotate-[20deg] blur-[2px]" />
      </div>

      {/* Content */}
      <div className="relative z-20 flex flex-col h-full justify-between" style={{ transform: "translateZ(60px)" }}>
        {/* Top */}
        <div className="flex justify-between items-start">
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-3">
                <span className="text-[10px] font-black text-white px-3 py-1 bg-[#00F0FF]/10 border border-[#00F0FF]/30 rounded-full tracking-[0.4em] uppercase text-[#00F0FF] shadow-[0_0_15px_rgba(0,240,255,0.3)]">
                   PRIME
                </span>
                <span className="text-xl text-[#00F0FF] animate-pulse">☄️</span>
            </div>
            <h2 className="text-4xl font-black italic tracking-tighter text-white uppercase drop-shadow-[0_0_15px_#00F0FF]">
              {displayName}
            </h2>
          </div>

          <div className="w-16 h-16 rounded-2xl border border-[#00F0FF]/30 bg-black/60 backdrop-blur-md overflow-hidden p-1 shadow-[0_0_30px_rgba(0,240,255,0.2)]">
              {avatarUrl ? (
                  <img src={avatarUrl} alt={displayName} className="w-full h-full object-cover rounded-xl" />
              ) : (
                  <div className="w-full h-full flex items-center justify-center text-3xl saturate-200">🚀</div>
              )}
          </div>
        </div>

        {/* Oracle Verdict */}
        <div className="space-y-4">
           <div className="h-[1.5px] w-full bg-gradient-to-r from-transparent via-[#00F0FF]/30 to-transparent" />
           <p className="text-[12px] font-bold text-center text-white/80 leading-snug uppercase tracking-tight px-2">
             «У него аура настолько высокая, что гравитация на него не действует. Чистый полет, никакого кринжа.»
           </p>
           <div className="h-[1.5px] w-full bg-gradient-to-r from-transparent via-[#00F0FF]/30 to-transparent" />
        </div>

        {/* Bottom */}
        <div className="space-y-8">
          <div className="flex justify-between items-end">
            <div className="flex flex-col gap-1">
              <span className="text-[9px] font-black text-[#00F0FF]/40 uppercase tracking-[0.5em] mb-1">Aura Level</span>
              <div className="flex items-baseline gap-2">
                <span className="text-6xl font-black italic tracking-tighter text-white drop-shadow-[0_0_15px_#00F0FF]">
                   ∞
                </span>
                <span className="text-[10px] font-black text-[#00F0FF]/60 uppercase mb-2">MAX</span>
              </div>
            </div>
            
            <div className="flex flex-col items-end gap-3 pb-2">
               <span className="text-[9px] font-black text-[#00F0FF]/50 tracking-[0.3em] uppercase">Control Matrix</span>
               <div className="flex gap-[3px]">
                   {[1,2,3,4,5,6].map(i => (
                     <div key={i} className="w-3 h-1 bg-[#00F0FF]/30 rounded-full" />
                   ))}
               </div>
            </div>
          </div>

          <button className="w-full py-6 rounded-[2.5rem] bg-[#00F0FF] text-black font-black text-[12px] uppercase tracking-[0.6em] transition-all duration-300 hover:scale-[1.03] active:scale-95 shadow-[0_20px_40px_rgba(0,240,255,0.3)] border-b-[4px] border-[#00B8C4]">
             ADMIN PANEL
          </button>
        </div>
      </div>
    </motion.div>
  );
}
