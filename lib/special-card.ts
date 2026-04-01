export const RESONANCE_SPECIAL_CARD = "RESONANCE" as const;

export type SpecialCard = typeof RESONANCE_SPECIAL_CARD;

export function isResonanceSpecialCard(value: string | null | undefined): value is SpecialCard {
  return value === RESONANCE_SPECIAL_CARD;
}
