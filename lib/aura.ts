export type AuraTier = 'НПС' | 'ГЕРОЙ' | 'ТОТ САМЫЙ' | 'СИГМА';

export interface TierConfig {
  id: 'NPC' | 'HERO' | 'THAT_ONE' | 'SIGMA';
  name: AuraTier;
  minPoints: number;
  maxPoints: number;
  color: string;
  glowClass: string;
  labelRu: string;
}

export const AURA_TIERS: TierConfig[] = [
  {
    id: 'NPC',
    name: 'НПС',
    minPoints: -Infinity,
    maxPoints: 500,
    color: '#6B7280',
    glowClass: 'glow-npc',
    labelRu: 'НПС',
  },
  {
    id: 'HERO',
    name: 'ГЕРОЙ',
    minPoints: 501,
    maxPoints: 2000,
    color: '#A855F7',
    glowClass: 'glow-mc',
    labelRu: 'ГЕРОЙ',
  },
  {
    id: 'THAT_ONE',
    name: 'ТОТ САМЫЙ',
    minPoints: 2001,
    maxPoints: 5000,
    color: '#4F46E5', // Indigo
    glowClass: 'glow-that-one',
    labelRu: 'ТОТ САМЫЙ',
  },
  {
    id: 'SIGMA',
    name: 'СИГМА',
    minPoints: 5001,
    maxPoints: Infinity,
    color: '#FBBF24', // Gold
    glowClass: 'glow-sigma',
    labelRu: 'СИГМА',
  },
];

export function getAuraTier(points: number): TierConfig {
  if (points <= 500) return AURA_TIERS[0];
  if (points <= 2000) return AURA_TIERS[1];
  if (points <= 5000) return AURA_TIERS[2];
  return AURA_TIERS[3];
}

export function getAuraEmoji(points: number): string {
  if (points < 0) return '💀';
  if (points <= 500) return '🤡';
  if (points <= 2000) return '🤠';
  if (points <= 5000) return '😏';
  if (points <= 10000) return '👑';
  return '🏆';
}

export function formatAuraPoints(points: number): string {
  return points.toLocaleString('ru-RU');
}
