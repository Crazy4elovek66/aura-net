"use client";

import CreatorCard from "@/components/CreatorCard";
import CreatorCardV2 from "@/components/CreatorCardV2";
import CreatorCardV3 from "@/components/CreatorCardV3";
import CreatorCardV4 from "@/components/CreatorCardV4";
import CreatorCardV5 from "@/components/CreatorCardV5";
import CreatorCardV6 from "@/components/CreatorCardV6";
import CreatorCardV7 from "@/components/CreatorCardV7";
import CreatorCardV8 from "@/components/CreatorCardV8";
import CreatorCardV9 from "@/components/CreatorCardV9";
import CreatorCardV10 from "@/components/CreatorCardV10";
import CreatorCardV11 from "@/components/CreatorCardV11";
import CreatorCardV12 from "@/components/CreatorCardV12";

// AI & Elite Collections
import CreatorCardArchitect from "@/components/CreatorCardArchitect";
import CreatorCardAntigravity from "@/components/CreatorCardAntigravity";
import CreatorCardAbsoluteZero from "@/components/CreatorCardAbsoluteZero";
import CreatorCardArchitectV2 from "@/components/CreatorCardArchitectV2";
import CreatorCardRoot from "@/components/CreatorCardRoot";
import CreatorCardPrime from "@/components/CreatorCardPrime";
import CreatorCardOrigin from "@/components/CreatorCardOrigin";
import CreatorCardSlot00 from "@/components/CreatorCardSlot00";

export default function AdminPreviewPage() {
  const allCards = [
    { id: "v19", name: "Origin Elite", component: CreatorCardOrigin },
    { id: "v18", name: "Prime Elite", component: CreatorCardPrime },
    { id: "v17", name: "Root Admin", component: CreatorCardRoot },
    { id: "v16", name: "Architect V2", component: CreatorCardArchitectV2 },
    { id: "v15", name: "Architect V1", component: CreatorCardArchitect },
    { id: "v14", name: "Antigravity V1", component: CreatorCardAntigravity },
    { id: "v13", name: "Absolute Zero V1", component: CreatorCardAbsoluteZero },
    { id: "v12", name: "v12.0 Holo", component: CreatorCardV12 },
    { id: "v11", name: "v11.0 Prism", component: CreatorCardV11 },
    { id: "v10", name: "v10.0 Dream", component: CreatorCardV10 },
    { id: "v9", name: "v9.0 Neon", component: CreatorCardV9 },
    { id: "v8", name: "v8.0 Silk", component: CreatorCardV8 },
    { id: "v7", name: "v7.0 Void", component: CreatorCardV7 },
    { id: "v6", name: "v6.0 Horizon", component: CreatorCardV6 },
    { id: "v5", name: "v5.0 Aurora Flow", component: CreatorCardV5 },
    { id: "v4", name: "v4.0 Glass", component: CreatorCardV4 },
    { id: "v3", name: "v3.0 Perfected Nebula", component: CreatorCardV3 },
    { id: "v2", name: "v2.0 Prism V1", component: CreatorCardV2 },
    { id: "v1", name: "v1.0 Nebula Original", component: CreatorCard },
  ];

  return (
    <div className="min-h-screen bg-[#020202] text-white p-4 md:p-12 font-unbounded flex flex-col items-center pb-[50vh]">
      {/* Header */}
      <div className="w-full max-w-6xl flex flex-col items-center text-center mb-40 mt-10">
        <h1 className="text-4xl md:text-7xl font-black italic uppercase tracking-tighter text-white/90">
           Aura Archive
        </h1>
        <p className="text-[10px] md:text-[12px] font-bold text-white/20 uppercase tracking-[0.6em] mt-4">
           Полный список итераций • 100% Масштаб
        </p>
      </div>

      <div className="w-full max-w-6xl mb-64 flex flex-col items-center">
         <div className="relative mb-16">
            <div className="absolute -inset-20 bg-cyan-600/10 blur-[120px] animate-pulse" />
            <span className="relative z-10 px-8 py-3 rounded-full bg-cyan-600/20 border border-cyan-400 text-[11px] font-black text-cyan-50 animate-bounce tracking-[0.6em] uppercase">
                GENERATION SLOT 00
            </span>
         </div>
         
         <div className="transform-gpu hover:scale-105 transition-transform duration-700">
            <CreatorCardSlot00 
              username="id1"
              displayName="ИЛЬЯ"
              avatarUrl={null}
              auraPoints={5000}
              votesUp={0}
              votesDown={0}
              progress={100}
            />
         </div>
      </div>

      {/* THE LIST (Single Grid, All Full Size) */}
      <div className="w-full max-w-7xl">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-x-12 gap-y-48 items-start">
           {allCards.map((card) => (
             <div key={card.id} className="flex flex-col items-center gap-10 group">
                <div className="text-center">
                   <h3 className="text-[11px] font-black uppercase italic tracking-[0.5em] text-white/20 group-hover:text-white/60 transition-colors">
                      {card.name}
                   </h3>
                </div>
                {/* Always 100% scale here */}
                <div className="w-full flex justify-center transform-gpu">
                  <card.component
                    username="ilya"
                    displayName="ИЛЬЯ"
                    avatarUrl={null}
                    {...(card.id === "v1" ? { auraPoints: 999999 } : {})}
                  />
                </div>
             </div>
           ))}
        </div>
      </div>

      {/* Footer System Stats */}
      <div className="w-full max-w-5xl mt-96 pt-20 border-t border-white/5 grid grid-cols-1 md:grid-cols-3 gap-10 opacity-20">
         <div className="space-y-4">
            <span className="text-[10px] font-black uppercase tracking-widest block">Core Engine</span>
            <p className="text-[10px] font-bold">Stable v5.2.0 // Archive Protocol</p>
         </div>
         <div className="space-y-4">
            <span className="text-[10px] font-black uppercase tracking-widest block">Render Quality</span>
            <p className="text-[10px] font-bold">Ultra High // 100% Scale Lock</p>
         </div>
         <div className="space-y-4">
            <span className="text-[10px] font-black uppercase tracking-widest block">Device Sync</span>
            <p className="text-[10px] font-bold">Optimized for Desktop & Mobile</p>
         </div>
      </div>
    </div>
  );
}
