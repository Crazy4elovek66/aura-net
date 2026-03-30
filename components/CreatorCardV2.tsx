"use client";

import { motion } from "framer-motion";
import { useState } from "react";

interface CreatorCardProps {
  username: string;
  displayName: string;
  avatarUrl: string | null;
}

export default function CreatorCardV2({
  username,
  displayName,
  avatarUrl,
}: CreatorCardProps) {
  const [mousePos, setMousePos] = useState({ x: 50, y: 50 });

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    setMousePos({ x, y });
  };

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      onMouseMove={handleMouseMove}
      className="relative w-full max-w-[360px] aspect-[9/13] rounded-[2.5rem] p-8 flex flex-col justify-between overflow-hidden shadow-2xl group select-none bg-[#0a0a0a] border border-white/5"
      style={{
        backfaceVisibility: "hidden",
        transform: "translateZ(0)",
        willChange: "transform, opacity, filter"
      }}
    >
      {/* 1. Иридесцентный фон (Prism/Light Refraction) */}
      <div 
        className="absolute inset-0 z-0 opacity-40 group-hover:opacity-60 transition-opacity duration-700"
        style={{
          background: `linear-gradient(${mousePos.x + mousePos.y}deg, #ff0080 0%, #7928ca 30%, #4facfe 60%, #00f2fe 100%)`,
          filter: 'blur(80px)',
          transform: `translate(${(mousePos.x - 50) / 10}px, ${(mousePos.y - 50) / 10}px) scale(1.2)`
        }}
      />

      {/* 2. Кристаллическая оверлей-сетка */}
      <div className="absolute inset-0 z-5 opacity-10 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] mix-blend-overlay" />

      {/* 3. Жидкое золото / Платиновая рамка */}
      <div className="absolute inset-0 z-10 border-[1px] border-white/20 rounded-[2.5rem] pointer-events-none" />
      <div 
        className="absolute inset-0 z-10 opacity-0 group-hover:opacity-100 transition-opacity duration-500 rounded-[2.5rem] border-[3px] border-transparent"
        style={{
          background: `linear-gradient(white, white) padding-box, 
                       conic-gradient(from ${mousePos.x}deg, #ffd700, #ffffff, #c0c0c0, #ffffff, #ffd700) border-box`,
          WebkitMaskComposite: 'xor',
        }}
      />

      {/* Content */}
      <div className="relative z-20 flex flex-col h-full justify-between">
        {/* Top: Branding */}
        <div className="flex justify-between items-start">
          <div className="flex flex-col">
            <div className="flex items-center gap-2 mb-3">
              <span className="px-3 py-1 rounded-lg bg-gradient-to-r from-yellow-400 to-white text-black text-[10px] font-black uppercase tracking-[0.2em] shadow-lg italic">
                PRISM ADMIN
              </span>
            </div>
            <h2 className="text-4xl font-black uppercase italic tracking-tighter text-white drop-shadow-[0_5px_15px_rgba(255,255,255,0.3)]">
              {displayName}
            </h2>
            <div className="flex items-center gap-1.5 mt-1">
              <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 shadow-[0_0_10px_#22d3ee]" />
              <p className="text-xs font-bold text-white/50 tracking-widest uppercase">Verified Oracle</p>
            </div>
          </div>

          <div className="w-14 h-14 rounded-full border-2 border-white/40 overflow-hidden shadow-[0_0_30px_rgba(255,255,255,0.2)] bg-black">
            {avatarUrl ? (
              <img src={avatarUrl} alt={displayName} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-3xl">🛡️</div>
            )}
          </div>
        </div>

        {/* Middle: Data Visualization */}
        <div className="relative">
          <div className="absolute -top-10 -right-10 w-32 h-32 bg-cyan-500/10 blur-3xl rounded-full" />
          <div className="p-6 rounded-3xl bg-black/40 border border-white/10 backdrop-blur-md">
            <div className="flex justify-between items-center mb-4">
              <span className="text-[9px] font-black uppercase text-white/30 tracking-widest">Global Auth Level</span>
              <span className="text-[9px] font-black text-cyan-400">CORE_ACCESS_GRANTED</span>
            </div>
            <div className="grid grid-cols-4 gap-1 h-3 items-end">
              {[40, 70, 45, 90, 60, 80, 50, 100].map((h, i) => (
                <div key={i} className="bg-white/10 rounded-t-sm w-full" style={{ height: `${h}%` }}>
                  <div className="h-full bg-cyan-400 opacity-50 animate-pulse" />
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Bottom: Divine Stats */}
        <div className="space-y-6">
          <div className="flex justify-between items-end">
            <div className="flex flex-col">
              <span className="text-[10px] font-black text-white/40 uppercase tracking-[0.3em] mb-1">Aura Magnitude</span>
              <div className="flex items-baseline gap-1">
                <span className="text-5xl font-black italic tracking-tighter text-white">
                  MAX
                </span>
                <span className="text-[10px] font-black text-cyan-400 animate-pulse">LOCKED</span>
              </div>
            </div>
            
            <div className="flex flex-col items-end gap-1">
              <span className="text-[10px] font-black italic text-white/30">SECURITY: OMNIPOTENT</span>
              <div className="flex gap-1">
                <div className="w-4 h-1 bg-white" />
                <div className="w-4 h-1 bg-white/20" />
                <div className="w-4 h-1 bg-white/20" />
              </div>
            </div>
          </div>

          <button className="w-full py-5 rounded-2xl bg-gradient-to-r from-cyan-400 via-white to-purple-400 text-black font-black text-[12px] uppercase tracking-[0.4em] transition-all hover:scale-[1.02] hover:shadow-[0_0_50px_rgba(34,211,238,0.4)] active:scale-95">
            EXECUTE COMMAND
          </button>
        </div>
      </div>

      {/* CSS For Animations */}
      <style jsx>{`
        @keyframes prism-shift {
          0% { filter: hue-rotate(0deg); }
          100% { filter: hue-rotate(360deg); }
        }
        .animate-prism {
          animation: prism-shift 10s linear infinite;
        }
      `}</style>
    </motion.div>
  );
}
