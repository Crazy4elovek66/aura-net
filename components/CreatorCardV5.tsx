"use client";

import { motion } from "framer-motion";
import { useState } from "react";

interface CreatorCardProps {
  username: string;
  displayName: string;
  avatarUrl: string | null;
}

export default function CreatorCardV5({
  username,
  displayName,
  avatarUrl,
}: CreatorCardProps) {
  const [mousePos, setMousePos] = useState({ x: 50, y: 50 });
  const particleTrails = Array.from({ length: 12 }, (_, index) => ({
    startX: 12 + ((index * 71) % 300),
    startY: 16 + ((index * 53) % 460),
    driftY: -40 - (index % 5) * 18,
    duration: 5 + (index % 5),
    delay: index * 0.35,
  }));

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    setMousePos({ x, y });
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      onMouseMove={handleMouseMove}
      className="relative w-full max-w-[360px] aspect-[9/13] rounded-[3.5rem] p-10 flex flex-col justify-between overflow-hidden group select-none bg-black shadow-[0_0_80px_rgba(0,0,0,1)] border border-white/5"
    >
      {/* 1. Анимированные слои Авроры (Animated Aurora Waves) */}
      <div className="absolute inset-0 z-0 opacity-40">
        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/80 to-transparent z-10" />
        
        {/* Волна 1: Фиолетовая */}
        <motion.div 
          animate={{
            x: [0, -50, 50, 0],
            rotate: [10, -10, 10],
          }}
          transition={{ duration: 15, repeat: Infinity, ease: "easeInOut" }}
          className="absolute -top-1/2 -left-1/2 w-[200%] h-[150%] bg-[radial-gradient(ellipse_at_center,rgba(168,85,247,0.3)_0%,transparent_60%)] blur-[100px]"
        />
        
        {/* Волна 2: Лазурная */}
        <motion.div 
          animate={{
            x: [0, 50, -50, 0],
            rotate: [-15, 15, -15],
          }}
          transition={{ duration: 10, repeat: Infinity, ease: "easeInOut", delay: 2 }}
          className="absolute -top-1/4 -right-1/2 w-[180%] h-[120%] bg-[radial-gradient(ellipse_at_center,rgba(59,130,246,0.3)_0%,transparent_60%)] blur-[90px]"
        />

        {/* Интерактивное пятно света под мышкой */}
        <div 
          className="absolute inset-0 z-5 opacity-40 transition-opacity duration-1000"
          style={{
            background: `radial-gradient(circle at ${mousePos.x}% ${mousePos.y}%, rgba(255, 255, 255, 0.15) 0%, transparent 40%)`
          }}
        />
      </div>

      {/* 2. Плавающие частицы (Particles) */}
      <div className="absolute inset-0 z-5 pointer-events-none">
        {particleTrails.map((particle, i) => (
          <motion.div
            key={i}
            initial={{ 
              x: particle.startX, 
              y: particle.startY,
              opacity: 0 
            }}
            animate={{ 
              y: [particle.startY, particle.startY + particle.driftY],
              opacity: [0, 0.4, 0]
            }}
            transition={{ 
              duration: particle.duration, 
              repeat: Infinity,
              delay: particle.delay
            }}
            className="absolute w-1 h-1 bg-white rounded-full blur-[1px]"
          />
        ))}
      </div>

      {/* 3. Тонкая анимированная рамка (Flow Border) */}
      <div className="absolute inset-0 z-10 rounded-[3.5rem] border border-white/10" />
      <div className="absolute inset-[-2px] z-10 pointer-events-none p-[2px] rounded-[3.5rem] overflow-hidden">
        <motion.div 
            animate={{ rotate: 360 }}
            transition={{ duration: 8, repeat: Infinity, ease: "linear" }}
            className="absolute -inset-x-full -inset-y-1/2 bg-[conic-gradient(from_0deg,transparent_0deg,transparent_270deg,rgba(255,255,255,0.2)_360deg)]"
        />
      </div>

      {/* Content */}
      <div className="relative z-20 flex flex-col h-full justify-between">
        {/* Top: Branding */}
        <div className="flex justify-between items-start">
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2">
                <span className="text-[10px] font-black text-white px-3 py-1 bg-white/5 border border-white/10 rounded-lg tracking-widest uppercase">
                  AURORA SEED
                </span>
            </div>
            <h2 className="text-4xl font-black italic tracking-tighter text-white drop-shadow-2xl">
              {displayName}
            </h2>
            <div className="flex items-center gap-1.5">
               <span className="w-2 h-[2px] bg-purple-500 rounded-full" />
               <p className="text-[10px] font-bold text-white/30 uppercase tracking-[0.4em]">Creator Node</p>
            </div>
          </div>

          <div className="relative group/avatar">
             <div className="absolute inset-0 bg-white/10 blur-xl rounded-full scale-0 group-hover/avatar:scale-150 transition-transform duration-700" />
             <div className="relative w-16 h-16 rounded-2xl border border-white/20 bg-black/40 backdrop-blur-md overflow-hidden p-0.5">
                {avatarUrl ? (
                    <img src={avatarUrl} alt={displayName} className="w-full h-full object-cover rounded-xl" />
                ) : (
                    <div className="w-full h-full flex items-center justify-center text-3xl">🪐</div>
                )}
             </div>
          </div>
        </div>

        {/* Center: Vibe Quote */}
        <div className="py-6 px-4">
           <div className="relative flex flex-col items-center gap-2">
              <span className="text-[40px] text-white/5 font-serif absolute -top-4 left-0">“</span>
              <p className="text-sm font-medium text-white/80 italic text-center leading-relaxed">
                Твоя аура — это энергия, которой ты делишься с миром. Свети ярче всех.
              </p>
              <div className="w-8 h-[1px] bg-white/10 mt-2" />
           </div>
        </div>

        {/* Bottom: Divine Score */}
        <div className="space-y-6">
          <div className="flex justify-between items-end">
            <div className="flex flex-col">
              <span className="text-[9px] font-black text-white/20 uppercase tracking-[0.5em] mb-1">Infinite Source</span>
              <div className="flex items-baseline gap-1">
                <span className="text-5.5xl font-black italic tracking-tighter text-white drop-shadow-[0_0_15px_rgba(255,255,255,0.5)]">
                  ∞ 
                </span>
                <span className="text-[10px] font-black text-white/10 mb-1">能量</span>
              </div>
            </div>
            
            <div className="flex flex-col items-end gap-2">
              <div className="px-3 py-1 rounded-full border border-white/5 bg-white/[0.03]">
                 <span className="text-[8px] font-black text-white/40 tracking-[0.2em] uppercase italic">System Owner 100%</span>
              </div>
              <div className="w-20 h-1 bg-white/5 rounded-full overflow-hidden">
                 <motion.div 
                    animate={{ x: [-100, 100] }}
                    transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
                    className="w-1/2 h-full bg-gradient-to-r from-transparent via-white/40 to-transparent" 
                 />
              </div>
            </div>
          </div>

          <button className="w-full py-5 rounded-[1.8rem] bg-white text-black font-black text-[11px] uppercase tracking-[0.5em] hover:bg-neutral-200 transition-all active:scale-95 shadow-[0_20px_40px_rgba(255,255,255,0.1)]">
             ОТКРЫТЬ МИР
          </button>
        </div>
      </div>
    </motion.div>
  );
}
