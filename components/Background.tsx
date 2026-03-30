"use client";

import { motion } from "framer-motion";

function FloatingOrb({
  delay,
  size,
  color,
  x,
  y,
}: {
  delay: number;
  size: number;
  color: string;
  x: string;
  y: string;
}) {
  return (
    <motion.div
      className="absolute rounded-full pointer-events-none"
      style={{
        width: size,
        height: size,
        background: `radial-gradient(circle, ${color} 0%, transparent 70%)`,
        left: x,
        top: y,
        opacity: 0.3,
        willChange: "transform",
      }}
      animate={{
        y: [0, -30, 0, 30, 0],
        x: [0, 15, 0, -15, 0],
        scale: [1, 1.1, 1, 0.9, 1],
      }}
      transition={{
        duration: 8,
        repeat: Infinity,
        delay,
        ease: "easeInOut",
      }}
    />
  );
}

export default function Background() {
  return (
    <>
      <div className="fixed inset-0 bg-grid pointer-events-none z-0" />
      <div className="fixed inset-0 overflow-hidden pointer-events-none z-0">
        <FloatingOrb delay={0} size={500} color="rgba(180,74,255,0.3)" x="10%" y="20%" />
        <FloatingOrb delay={2} size={400} color="rgba(57,255,20,0.2)" x="70%" y="60%" />
        <FloatingOrb delay={4} size={350} color="rgba(255,45,149,0.15)" x="50%" y="10%" />
      </div>
    </>
  );
}
