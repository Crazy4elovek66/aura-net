"use client";

import { motion } from "framer-motion";
import { useEffect, useState } from "react";

interface CreatorCardProps {
  username: string;
  displayName: string;
  avatarUrl: string | null;
  auraPoints?: number;
}

export default function CreatorCard({
  username,
  displayName,
  avatarUrl,
  auraPoints = 0,
}: CreatorCardProps) {
  // Анимация свечения
  const [mousePos, setMousePos] = useState({ x: 50, y: 50 });

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    setMousePos({ x, y });
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      onMouseMove={handleMouseMove}
      className="relative w-full max-w-[360px] aspect-[9/13] rounded-[3rem] p-8 flex flex-col justify-between overflow-hidden shadow-[0_0_80px_rgba(255,255,255,0.1)] group select-none bg-black border border-white/10"
      style={{
        backfaceVisibility: "hidden",
        transform: "translateZ(0)",
        willChange: "transform, opacity, filter"
      }}
    >
      {/* 1. Анимированный градиентный фон (Nebula) */}
      <div className="absolute inset-0 z-0">
        <div 
          className="absolute inset-0 opacity-30 transition-opacity duration-1000 group-hover:opacity-50"
          style={{
            background: `radial-gradient(circle at ${mousePos.x}% ${mousePos.y}%, rgba(168, 85, 247, 0.4) 0%, transparent 50%),
                         radial-gradient(circle at ${100 - mousePos.x}% ${100 - mousePos.y}%, rgba(59, 130, 246, 0.4) 0%, transparent 50%)`
          }}
        />
        <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20 contrast-150 brightness-100" />
      </div>

      {/* 2. Золотая переливающаяся рамка */}
      <div className="absolute inset-0 z-5 pointer-events-none rounded-[3rem] border-2 border-transparent bg-gradient-to-br from-yellow-500/20 via-white/40 to-yellow-500/20 [mask-image:linear-gradient(white,white)_padding-box,linear-gradient(white,white)] [mask-composite:exclude] animate-gradient-xy" />

      {/* Content */}
      <div className="relative z-10 flex flex-col h-full justify-between">
        {/* Top: Creator ID */}
        <div className="flex justify-between items-start">
          <div className="flex flex-col">
            <div className="flex items-center gap-2 mb-2">
              <span className="px-3 py-1 rounded-full bg-white text-black text-[9px] font-black uppercase tracking-[0.2em] shadow-[0_0_15px_rgba(255,255,255,0.5)]">
                CREATOR
              </span>
              <span className="text-xl">🪐</span>
            </div>
            <h2 className="text-3xl font-black italic tracking-tighter text-white drop-shadow-lg">
              {displayName}
            </h2>
            <p className="text-xs font-bold text-white/40">@{username}</p>
          </div>

          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-white/10 to-white/5 border border-white/20 p-0.5 shadow-2xl relative overflow-hidden group-hover:scale-105 transition-transform duration-500">
            {avatarUrl ? (
              <img src={avatarUrl} alt={displayName} className="w-full h-full object-cover rounded-xl" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-3xl">🌌</div>
            )}
            <div className="absolute inset-0 bg-gradient-to-tr from-purple-500/20 to-transparent" />
          </div>
        </div>

        {/* Middle: Signature / Quote */}
        <div className="py-6">
          <div className="p-5 rounded-[2rem] bg-white/[0.03] border border-white/10 backdrop-blur-xl relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-white/20 to-transparent" />
            <p className="text-[14px] font-medium leading-relaxed italic text-white/90 text-center">
              «Создатель этого мира. Каждая искра ауры здесь под моим присмотром.»
            </p>
            <div className="flex justify-center mt-4">
              <div className="px-4 py-1 rounded-full bg-white/5 border border-white/10 flex items-center gap-2">
                <div className="w-1 h-1 rounded-full bg-yellow-400 animate-ping" />
                <span className="text-[8px] font-black uppercase tracking-[0.3em] text-white/60">System Architect</span>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom: Divine Points */}
        <div className="space-y-6">
          <div className="flex justify-between items-end">
            <div className="flex flex-col">
              <span className="text-[10px] font-black text-white/30 uppercase tracking-[0.3em] mb-1">Infinite Power</span>
              <div className="flex items-baseline gap-1">
                <span className="text-5xl font-black italic tracking-tighter text-transparent bg-clip-text bg-gradient-to-r from-white via-yellow-200 to-white animate-pulse">
                  ∞
                </span>
                <span className="text-xs font-black text-white/20 mb-1">POINTS</span>
              </div>
            </div>
            
            <div className="flex flex-col items-end gap-2">
              <div className="text-[10px] font-black text-white/40 tracking-widest uppercase italic">
                Aura Authority: 100%
              </div>
              <div className="w-24 h-1.5 bg-white/5 rounded-full overflow-hidden border border-white/10 p-[1px]">
                <div className="h-full bg-gradient-to-r from-purple-500 via-blue-500 to-purple-500 w-full animate-gradient-x" />
              </div>
            </div>
          </div>

          <button className="w-full py-5 rounded-[1.5rem] bg-white text-black font-black text-xs uppercase tracking-[0.4em] hover:bg-yellow-400 transition-all active:scale-95 shadow-[0_0_40px_rgba(255,255,255,0.2)]">
            УПРАВЛЯТЬ МИРОМ
          </button>
        </div>
      </div>

      {/* CSS For Animations */}
      <style jsx>{`
        @keyframes gradient-xy {
          0%, 100% { background-position: 0% 0%; }
          50% { background-position: 100% 100%; }
        }
        .animate-gradient-xy {
          background-size: 400% 400%;
          animation: gradient-xy 15s ease infinite;
        }
        @keyframes gradient-x {
          0% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
          100% { background-position: 0% 50%; }
        }
        .animate-gradient-x {
          background-size: 200% auto;
          animation: gradient-x 3s linear infinite;
        }
      `}</style>
    </motion.div>
  );
}
