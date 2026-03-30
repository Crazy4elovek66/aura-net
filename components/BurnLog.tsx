"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { motion } from "framer-motion";

export default function BurnLog({ profileId }: { profileId: string }) {
  const [haters, setHaters] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  useEffect(() => {
    async function fetchHaters() {
      const { data } = await supabase
        .from("votes")
        .select(`
          created_at,
          is_anonymous,
          profiles!votes_voter_id_fkey (username, display_name)
        `)
        .eq("target_id", profileId)
        .eq("vote_type", "down")
        .order("created_at", { ascending: false })
        .limit(10);

      if (data) setHaters(data);
      setLoading(false);
    }

    fetchHaters();
  }, [profileId, supabase]);

  if (loading) return <div className="text-center p-4">Подгружаем хейтеров... 💀</div>;

  return (
    <div className="w-full mt-4 space-y-2">
      <h3 className="text-[10px] font-black uppercase text-neon-pink tracking-[0.2em] mb-4">Журнал Сжигания (Oracle)</h3>
      {haters.length === 0 ? (
        <p className="text-xs text-muted italic">Пока никто не рискнул сжечь твою ауру. 😇</p>
      ) : (
        haters.map((vote, i) => (
          <motion.div 
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            key={i} 
            className="flex justify-between items-center p-3 rounded-xl bg-white/5 border border-white/5"
          >
            <div className="flex flex-col">
              <span className="text-[10px] font-black uppercase tracking-widest text-white/80">
                {vote.is_anonymous ? "DEEP STATE (Анонимно)" : `@${vote.profiles?.username || 'user'}`}
              </span>
              <span className="text-[8px] text-muted uppercase">
                {new Date(vote.created_at).toLocaleString('ru-RU')}
              </span>
            </div>
            <span className="text-neon-pink font-bold text-xs">-АУРА</span>
          </motion.div>
        ))
      )}
    </div>
  );
}
