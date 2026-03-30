"use client";

import { motion, useMotionValue, useSpring, useTransform } from "framer-motion";
import { useState } from "react";

interface CreatorCardProps {
  username: string;
  displayName: string;
  avatarUrl: string | null;
}

export default function CreatorCardV4({
  username,
  displayName,
  avatarUrl,
}: CreatorCardProps) {
  const mouseX = useSpring(useMotionValue(0), { stiffness: 100, damping: 30 });
  const mouseY = useSpring(useMotionValue(0), { stiffness: 100, damping: 30 });

  const rotateX = useTransform(mouseY, [-400, 400], [15, -15]);
  const rotateY = useTransform(mouseX, [-400, 400], [-15, 15]);

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
    <div className="relative group perspective-1000" onMouseMove={handleMouseMove} onMouseLeave={handleMouseLeave}>
      {/* 1. Бэкграунд Корона (Eclipse Corona) */}
      <motion.div 
        style={{
          x: useTransform(mouseX, [-400, 400], [-80, 80]),
          y: useTransform(mouseY, [-400, 400], [-80, 80]),
        }}
        className="absolute -inset-20 z-0 bg-white/20 rounded-full blur-[140px] opacity-0 group-hover:opacity-40 transition-opacity duration-1000"
      />

      {/* 2. Сама карточка */}
      <motion.div
        style={{
          rotateX,
          rotateY,
          transformStyle: "preserve-3d",
          backfaceVisibility: "hidden",
        }}
        className="relative w-full max-w-[360px] aspect-[9/13] rounded-[4rem] p-10 flex flex-col justify-between overflow-hidden group/card bg-black shadow-[0_50px_100px_rgba(0,0,0,1)] border border-white/10"
      >
        {/* Отражения (Reflections) */}
        <motion.div 
          style={{
            x: useTransform(mouseX, [-400, 400], [100, -100]),
            y: useTransform(mouseY, [-400, 400], [100, -100]),
          }}
          className="absolute inset-0 z-10 pointer-events-none opacity-30 bg-gradient-to-tr from-transparent via-white/40 to-transparent skew-y-12 translate-y-[-50%]"
        />

        {/* Контент */}
        <div className="relative z-20 flex flex-col h-full justify-between" style={{ transform: "translateZ(80px)" }}>
          {/* Header */}
          <div className="flex justify-between items-start">
            <div className="flex flex-col gap-2">
              <div className="w-fit px-4 py-1 rounded-full border border-white/20 bg-black/40 backdrop-blur-md text-[9px] font-black uppercase tracking-[0.4em] text-white/50">
                ECLIPSE
              </div>
              <h2 className="text-4xl font-black uppercase tracking-tighter text-white drop-shadow-[0_0_20px_rgba(255,255,255,0.4)]">
                {displayName}
              </h2>
            </div>
            
            <div className="w-16 h-16 rounded-full border border-white/20 bg-white shadow-[0_0_40px_rgba(255,255,255,0.2)] p-0.5 overflow-hidden">
                {avatarUrl ? (
                  <img src={avatarUrl} alt={displayName} className="w-full h-full object-cover rounded-full" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-4xl invert">👁️</div>
                )}
            </div>
          </div>

          {/* Center Quote */}
          <div className="text-center space-y-4">
            <div className="w-full h-[1px] bg-gradient-to-r from-transparent via-white/10 to-transparent" />
            <p className="text-[14px] font-bold italic text-white/40 leading-relaxed uppercase tracking-tighter scale-y-125">
              "When the light fades, the aura remains."
            </p>
            <div className="w-full h-[1px] bg-gradient-to-r from-transparent via-white/10 to-transparent" />
          </div>

          {/* Bottom Footer */}
          <div className="space-y-8">
            <div className="flex justify-between items-end">
              <div className="flex flex-col">
                <span className="text-[10px] font-black text-white/20 uppercase tracking-[0.5em] mb-2">Prime Source</span>
                <span className="text-6xl font-black italic tracking-tighter text-white select-none">
                  NULL
                </span>
              </div>
              <div className="flex flex-col items-end gap-1">
                <span className="text-[8px] font-black text-white/40 tracking-widest uppercase italic">Master ID: 000</span>
                <div className="flex gap-1 overflow-hidden">
                   {[1,2,3,4,5,6].map(i => (
                     <motion.div 
                        key={i} 
                        animate={{ opacity: [0.2, 1, 0.2] }}
                        transition={{ duration: 2, repeat: Infinity, delay: i * 0.2 }}
                        className="w-[1px] h-4 bg-white" 
                     />
                   ))}
                </div>
              </div>
            </div>

            <button className="w-full py-6 rounded-[2rem] bg-white text-black font-black text-[12px] uppercase tracking-[0.6em] transition-all duration-500 hover:bg-white hover:shadow-[0_0_80px_rgba(255,255,255,0.3)] active:scale-95">
              ENGAGE
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
