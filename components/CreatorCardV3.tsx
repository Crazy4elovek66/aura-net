"use client";

import { motion, useMotionValue, useSpring, useTransform } from "framer-motion";
import { useEffect, useState } from "react";

interface CreatorCardProps {
  username: string;
  displayName: string;
  avatarUrl: string | null;
}

export default function CreatorCardV3({
  username,
  displayName,
  avatarUrl,
}: CreatorCardProps) {
  // Плавное следование за мышью (Spring)
  const mouseX = useSpring(useMotionValue(0), { stiffness: 100, damping: 30 });
  const mouseY = useSpring(useMotionValue(0), { stiffness: 100, damping: 30 });

  const rotateX = useTransform(mouseY, [-300, 300], [10, -10]);
  const rotateY = useTransform(mouseX, [-300, 300], [-10, 10]);

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
        backfaceVisibility: "hidden",
        transform: "translateZ(0)",
        willChange: "transform, opacity, filter"
      }}
      className="relative w-full max-w-[360px] aspect-[9/13] rounded-[3.5rem] p-10 flex flex-col justify-between overflow-hidden group select-none bg-[#050505] border border-white/5 shadow-[0_40px_100px_rgba(0,0,0,0.8)]"
    >
      {/* 1. Глубокая Туманность (Layered Nebula) */}
      <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none">
        {/* Фиолетовое облако */}
        <motion.div 
          animate={{
            x: [0, 20, -20, 0],
            y: [0, -30, 30, 0],
          }}
          transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
          className="absolute -top-1/4 -left-1/4 w-[150%] h-[150%] opacity-20 bg-[radial-gradient(circle_at_center,rgba(168,85,247,0.3)_0%,transparent_60%)] blur-[80px]"
        />
        {/* Синее облако */}
        <motion.div 
          animate={{
            x: [0, -40, 40, 0],
            y: [0, 20, -20, 0],
          }}
          transition={{ duration: 15, repeat: Infinity, ease: "linear" }}
          className="absolute -bottom-1/4 -right-1/4 w-[150%] h-[150%] opacity-20 bg-[radial-gradient(circle_at_center,rgba(59,130,246,0.3)_0%,transparent_60%)] blur-[100px]"
        />
        {/* Шум */}
        <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-[0.15] contrast-150 brightness-150 mix-blend-overlay" />
      </div>

      {/* 2. Тонкая светящаяся рамка (Diamond Path) */}
      <div className="absolute inset-0 z-10 pointer-events-none border border-white/10 rounded-[3.5rem]" />
      <div className="absolute inset-0 z-10 pointer-events-none p-[1px] rounded-[3.5rem] overflow-hidden">
        <div className="w-full h-full rounded-[3.5rem] border border-transparent [mask-image:linear-gradient(white,white)_padding-box,linear-gradient(white,white)] [mask-composite:exclude]">
          <motion.div 
            animate={{ rotate: 360 }}
            transition={{ duration: 10, repeat: Infinity, ease: "linear" }}
            className="absolute -inset-1/2 bg-[conic-gradient(from_0deg,transparent_0deg,transparent_300deg,white_360deg)] opacity-40"
          />
        </div>
      </div>

      {/* Content Layer (3D effect) */}
      <div className="relative z-20 flex flex-col h-full justify-between" style={{ transform: "translateZ(50px)" }}>
        
        {/* Header Section */}
        <div className="space-y-4">
          <div className="flex justify-between items-start">
            <div className="flex flex-col gap-1">
              <span className="w-fit px-3 py-1 rounded-full bg-white text-[9px] font-black uppercase tracking-[0.3em] text-black shadow-[0_0_20px_rgba(255,255,255,0.4)]">
                CREATOR
              </span>
              <div className="flex items-center gap-2 mt-2">
                <span className="text-sm">🌌</span>
                <span className="text-[10px] font-bold text-white/30 uppercase tracking-[0.4em]">Origin Node</span>
              </div>
            </div>
            
            <div className="relative w-16 h-16">
              <div className="absolute inset-0 bg-white/10 blur-xl rounded-full" />
              <div className="relative w-full h-full rounded-2xl border border-white/20 bg-black/40 backdrop-blur-md p-1 shadow-2xl">
                {avatarUrl ? (
                  <img src={avatarUrl} alt={displayName} className="w-full h-full object-cover rounded-xl" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-4xl grayscale opacity-50">👤</div>
                )}
              </div>
            </div>
          </div>

          <div className="space-y-1">
            <h2 className="text-4xl font-black italic uppercase tracking-tighter text-white drop-shadow-2xl">
              {displayName}
            </h2>
            <p className="text-[11px] font-bold text-white/20 uppercase tracking-[0.2em]">@{username}</p>
          </div>
        </div>

        {/* Status Area */}
        <div className="py-8">
          <div className="relative p-6 rounded-[2.5rem] bg-white/[0.02] border border-white/5 backdrop-blur-2xl overflow-hidden group/box transition-all duration-700 hover:bg-white/[0.04]">
            <div className="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-white/20 to-transparent" />
            <div className="flex flex-col gap-4 text-center">
              <p className="text-xs font-medium text-white/60 italic leading-relaxed px-2">
                «Сила не в алгоритмах, а в ауре, которую мы создаем вместе.»
              </p>
              <div className="flex justify-center items-center gap-3">
                <div className="h-[1px] w-8 bg-white/10" />
                <span className="text-[8px] font-black uppercase tracking-[0.5em] text-white/30">System Admin</span>
                <div className="h-[1px] w-8 bg-white/10" />
              </div>
            </div>
          </div>
        </div>

        {/* Score Area */}
        <div className="space-y-8">
          <div className="flex justify-between items-end">
            <div className="flex flex-col gap-2">
              <span className="text-[10px] font-black text-white/20 uppercase tracking-[0.4em]">Infinite Magnitude</span>
              <div className="flex items-baseline gap-1">
                <span className="text-6xl font-black italic tracking-tighter text-transparent bg-clip-text bg-gradient-to-br from-white via-white/90 to-white/40 animate-pulse">
                  ∞ 
                </span>
                <span className="text-[10px] font-black text-white/10 mb-2">pts</span>
              </div>
            </div>
            
            <div className="flex flex-col items-end gap-3 pb-2">
              <div className="flex gap-[3px]">
                {[1,2,3,4,5].map(i => (
                  <div key={i} className="w-1.5 h-1.5 rounded-full bg-white shadow-[0_0_8px_white]" />
                ))}
              </div>
              <span className="text-[9px] font-black text-white/40 tracking-[0.2em] italic uppercase">God Mode Active</span>
            </div>
          </div>

          <button className="w-full py-5 rounded-[1.8rem] bg-white text-black font-black text-[11px] uppercase tracking-[0.5em] transition-all duration-500 hover:tracking-[0.6em] hover:bg-white/90 active:scale-95 shadow-[0_30px_60px_-15px_rgba(255,255,255,0.2)]">
            УПРАВЛЯТЬ
          </button>
        </div>
      </div>

      <style jsx>{`
        @keyframes pulse-subtle {
          0%, 100% { opacity: 0.3; }
          50% { opacity: 0.5; }
        }
        .animate-pulse-subtle {
          animation: pulse-subtle 4s ease-in-out infinite;
        }
      `}</style>
    </motion.div>
  );
}
