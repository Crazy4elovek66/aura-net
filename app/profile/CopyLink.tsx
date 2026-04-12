"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

interface CopyLinkProps {
  link: string;
}

export default function CopyLink({ link }: CopyLinkProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Ошибка копирования", err);
    }
  };

  return (
    <div className="w-full max-w-sm relative mx-auto">
      <h3 className="text-xs font-bold uppercase tracking-widest text-muted mb-4 px-1 text-center">Публичная ссылка</h3>
      
      <button
        onClick={handleCopy}
        className="w-full neo-card p-4 rounded-xl border border-card-border bg-black/50 flex items-center justify-between gap-4 group hover:border-neon-purple/50 transition-all text-left relative z-10"
      >
        <div className="flex-1 overflow-hidden">
          <code className="text-xs text-neon-purple truncate block select-none">
            {link}
          </code>
        </div>
        
        <div className="relative flex items-center justify-center min-w-[24px]">
          <AnimatePresence mode="wait">
            {copied ? (
              <motion.span
                key="check"
                initial={{ opacity: 0, scale: 0.5 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.5 }}
                className="text-neon-green text-sm font-bold"
              >
                ✅
              </motion.span>
            ) : (
              <motion.span
                key="copy"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="group-hover:scale-110 transition-transform opacity-50 group-hover:opacity-100"
              >
                📋
              </motion.span>
            )}
          </AnimatePresence>
        </div>

        {/* Floating Tooltip */}
        <AnimatePresence>
          {copied && (
            <motion.div
              initial={{ opacity: 0, y: 10, x: "-50%" }}
              animate={{ opacity: 1, y: -55, x: "-50%" }}
              exit={{ opacity: 0, y: 10, x: "-50%" }}
              className="absolute left-1/2 top-0 px-4 py-2 bg-neon-green text-black text-[10px] font-bold rounded-full shadow-[0_0_20px_rgba(57,255,20,0.5)] pointer-events-none whitespace-nowrap z-50"
            >
              СКОПИРОВАНО
            </motion.div>
          )}
        </AnimatePresence>
      </button>
    </div>
  );
}
