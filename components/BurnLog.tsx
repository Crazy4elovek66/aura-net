"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { motion } from "framer-motion";

const supabase = createClient();

interface VoteRow {
  created_at: string;
  is_anonymous: boolean;
  voter_id: string | null;
}

interface ProfileRow {
  id: string;
  username: string;
  display_name: string | null;
}

interface BurnEntry {
  created_at: string;
  is_anonymous: boolean;
  username: string | null;
}

export default function BurnLog({ profileId }: { profileId: string }) {
  const [entries, setEntries] = useState<BurnEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isCancelled = false;

    async function fetchBurnLog() {
      setLoading(true);

      const { data: votes, error: votesError } = await supabase
        .from("votes")
        .select("created_at, is_anonymous, voter_id")
        .eq("target_id", profileId)
        .eq("vote_type", "down")
        .order("created_at", { ascending: false })
        .limit(10);

      if (votesError || !votes) {
        if (!isCancelled) {
          setEntries([]);
          setLoading(false);
        }
        return;
      }

      const voterIds = votes
        .filter((vote: VoteRow) => !vote.is_anonymous && Boolean(vote.voter_id))
        .map((vote: VoteRow) => vote.voter_id as string);

      const uniqueIds = Array.from(new Set(voterIds));
      let profileMap = new Map<string, string>();

      if (uniqueIds.length > 0) {
        const { data: profiles } = await supabase
          .from("profiles")
          .select("id, username, display_name")
          .in("id", uniqueIds);

        if (profiles) {
          profileMap = new Map(
            (profiles as ProfileRow[]).map((profile) => [profile.id, profile.username || profile.display_name || "игрок"])
          );
        }
      }

      const mapped = (votes as VoteRow[]).map((vote) => ({
        created_at: vote.created_at,
        is_anonymous: vote.is_anonymous,
        username: vote.voter_id ? profileMap.get(vote.voter_id) || null : null,
      }));

      if (!isCancelled) {
        setEntries(mapped);
        setLoading(false);
      }
    }

    fetchBurnLog();

    return () => {
      isCancelled = true;
    };
  }, [profileId]);

  if (loading) return <div className="text-center p-4">Подгружаем хейтеров...</div>;

  return (
    <div className="w-full mt-4 space-y-2">
      <h3 className="text-[10px] font-black uppercase text-neon-pink tracking-[0.2em] mb-4">Журнал Сжигания (Оракул)</h3>
      {entries.length === 0 ? (
        <p className="text-xs text-muted italic">Пока никто не рискнул сжечь твою ауру.</p>
      ) : (
        entries.map((vote, i) => (
          <motion.div
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            key={`${vote.created_at}-${i}`}
            className="flex justify-between items-center p-3 rounded-xl bg-white/5 border border-white/5"
          >
            <div className="flex flex-col">
              <span className="text-[10px] font-black uppercase tracking-widest text-white/80">
                {vote.is_anonymous ? "ТЕНЕВОЙ РЕЖИМ (Анонимно)" : `@${vote.username || "игрок"}`}
              </span>
              <span className="text-[8px] text-muted uppercase">{new Date(vote.created_at).toLocaleString("ru-RU")}</span>
            </div>
            <span className="text-neon-pink font-bold text-xs">-АУРА</span>
          </motion.div>
        ))
      )}
    </div>
  );
}

