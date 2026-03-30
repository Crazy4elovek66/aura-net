export type AuraTier = "NPC" | "Hero" | "That One" | "Sigma";

export interface TierInfo {
  tier: AuraTier;
  label: string;
  labelRu: string;
  emoji: string;
  color: string;
  glowClass: string;
  progressClass: string;
  min: number;
  max: number;
  progress: number; // 0-100
}

export function getAuraTier(aura: number): TierInfo {
  if (aura >= 5001) {
    return {
      tier: "Sigma",
      label: "SIGMA",
      labelRu: "СИГМА",
      emoji: "⚡",
      color: "var(--neon-green)",
      glowClass: "neon-glow-green",
      progressClass: "progress-sigma",
      min: 5001,
      max: 10000,
      progress: Math.min(100, ((aura - 5001) / 4999) * 100),
    };
  }
  if (aura >= 2001) {
    return {
      tier: "That One",
      label: "THAT ONE",
      labelRu: "ТОТ САМЫЙ",
      emoji: "💎",
      color: "#4F46E5",
      glowClass: "neon-glow-indigo",
      progressClass: "progress-that-one",
      min: 2001,
      max: 5000,
      progress: ((aura - 2001) / (5000 - 2001)) * 100,
    };
  }
  if (aura >= 501) {
    return {
      tier: "Hero",
      label: "HERO",
      labelRu: "ГЕРОЙ",
      emoji: "💜",
      color: "var(--neon-purple)",
      glowClass: "neon-glow-purple",
      progressClass: "progress-main",
      min: 501,
      max: 2000,
      progress: ((aura - 501) / (2000 - 501)) * 100,
    };
  }
  return {
    tier: "NPC",
    label: "NPC",
    labelRu: "НПС",
    emoji: "👻",
    color: "var(--tier-npc)",
    glowClass: "",
    progressClass: "progress-npc",
    min: 0,
    max: 500,
    progress: (aura / 500) * 100,
  };
}

export function calculateDecay(aura: number, hoursElapsed: number): number {
  const decayRate = 0.03; // 3% за 24ч
  const decaysCount = hoursElapsed / 24;
  return Math.floor(aura * Math.pow(1 - decayRate, decaysCount));
}

export function formatAura(aura: number): string {
  if (aura >= 10000) return `${(aura / 1000).toFixed(1)}k`;
  return aura.toLocaleString("ru-RU");
}

export function getNextTierName(aura: number): string | null {
  if (aura < 501) return "Герой";
  if (aura < 2001) return "Тот самый";
  if (aura < 5001) return "Сигма";
  return null;
}

export function getPointsToNextTier(aura: number): number | null {
  if (aura < 501) return 501 - aura;
  if (aura < 2001) return 2001 - aura;
  if (aura < 5001) return 5001 - aura;
  return null;
}
