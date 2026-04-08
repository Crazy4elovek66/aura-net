import { ANONYMOUS_VOTE_COST, ANONYMOUS_VOTE_DAILY_LIMIT, VOTE_DAILY_LIMIT } from "../economy.ts";

const FORBIDDEN_ERROR_MESSAGE = "РќРµРґРѕСЃС‚Р°С‚РѕС‡РЅРѕ РїСЂР°РІ.";

export const AI_COMMENTS = {
  up: [
    "Р­С‚РѕС‚ РІР°Р№Р± РЅРµ РєСѓРїРёС‚СЊ. РџР»СЋСЃ Р°СѓСЂР° Р·Р°СЃР»СѓР¶РµРЅ.",
    "РЎРёР»СЊРЅС‹Р№ С…РѕРґ. РџР»СЋСЃ СѓРІР°Р¶РµРЅРёРµ РІ РєРѕРїРёР»РєСѓ.",
    "РЎС‚РёР»СЊ СЃС‡РёС‚С‹РІР°РµС‚СЃСЏ СЃСЂР°Р·Сѓ. РҐРѕСЂРѕС€РёР№ РїР»СЋСЃ.",
    "Р­С‚Рѕ Р±С‹Р»Рѕ РјРѕС‰РЅРѕ. РђСѓСЂР° РїРѕС€Р»Р° РІРІРµСЂС….",
  ],
  down: [
    "РЎРµРіРѕРґРЅСЏ РІР°Р№Р± РЅРµ РґРѕС‚СЏРЅСѓР».",
    "РњРёРЅСѓСЃ Р°СѓСЂР°. РџРѕСЂР° РїРµСЂРµР·Р°СЂСЏРґРёС‚СЊСЃСЏ.",
    "Р­С‚РѕС‚ Р·Р°С…РѕРґ РЅРµ СЃСЂР°Р±РѕС‚Р°Р».",
    "РљСЂРёРЅР¶-С‡РµРє РЅРµ РїСЂРѕР№РґРµРЅ. РќСѓР¶РЅРѕ РІРѕР·РІСЂР°С‰РµРЅРёРµ.",
  ],
} as const;

export interface CastVoteRow {
  vote_id?: string | null;
  aura_change?: number | null;
  regular_votes_used?: number | null;
  anonymous_votes_used?: number | null;
  voter_aura_left?: number | null;
  target_aura?: number | null;
}

export function mapVoteRpcError(message: string) {
  const normalized = message.toLowerCase();

  if (normalized.includes("already voted")) {
    return {
      status: 400,
      code: "ALREADY_VOTED",
      error: "РўС‹ СѓР¶Рµ РіРѕР»РѕСЃРѕРІР°Р» Р·Р° СЌС‚РѕС‚ РїСЂРѕС„РёР»СЊ.",
    };
  }

  if (normalized.includes("self vote forbidden")) {
    return {
      status: 400,
      code: "SELF_VOTE_FORBIDDEN",
      error: "Р“РѕР»РѕСЃРѕРІР°С‚СЊ Р·Р° СЃРµР±СЏ РЅРµР»СЊР·СЏ.",
    };
  }

  if (normalized.includes("anonymous vote daily limit reached")) {
    return {
      status: 429,
      code: "ANONYMOUS_DAILY_LIMIT_REACHED",
      error: `Р›РёРјРёС‚ Р°РЅРѕРЅРёРјРЅС‹С… РіРѕР»РѕСЃРѕРІ РЅР° СЃРµРіРѕРґРЅСЏ РёСЃС‡РµСЂРїР°РЅ (${ANONYMOUS_VOTE_DAILY_LIMIT}/${ANONYMOUS_VOTE_DAILY_LIMIT}).`,
    };
  }

  if (normalized.includes("regular vote daily limit reached")) {
    return {
      status: 429,
      code: "VOTE_DAILY_LIMIT_REACHED",
      error: `Р›РёРјРёС‚ РѕР±С‹С‡РЅС‹С… РіРѕР»РѕСЃРѕРІ РЅР° СЃРµРіРѕРґРЅСЏ РёСЃС‡РµСЂРїР°РЅ (${VOTE_DAILY_LIMIT}/${VOTE_DAILY_LIMIT}).`,
    };
  }

  if (normalized.includes("insufficient aura")) {
    return {
      status: 403,
      code: "INSUFFICIENT_AURA",
      error: `РќРµРґРѕСЃС‚Р°С‚РѕС‡РЅРѕ Р°СѓСЂС‹ РґР»СЏ Р°РЅРѕРЅРёРјРЅРѕРіРѕ РіРѕР»РѕСЃР°. РќСѓР¶РЅРѕ ${ANONYMOUS_VOTE_COST}.`,
    };
  }

  if (normalized.includes("invalid vote type")) {
    return {
      status: 400,
      code: "INVALID_VOTE_PAYLOAD",
      error: "РќРµРєРѕСЂСЂРµРєС‚РЅС‹Рµ РґР°РЅРЅС‹Рµ РіРѕР»РѕСЃР°.",
    };
  }

  if (normalized.includes("not allowed")) {
    return {
      status: 403,
      code: "FORBIDDEN",
      error: FORBIDDEN_ERROR_MESSAGE,
    };
  }

  if (normalized.includes("profile not found")) {
    return {
      status: 404,
      code: "PROFILE_NOT_FOUND",
      error: "РџСЂРѕС„РёР»СЊ РЅРµ РЅР°Р№РґРµРЅ.",
    };
  }

  if (normalized.includes("function") && normalized.includes("does not exist")) {
    return {
      status: 501,
      code: "FUNCTION_MISSING",
      error: "Р¤СѓРЅРєС†РёСЏ РіРѕР»РѕСЃРѕРІР°РЅРёСЏ РЅРµ РЅР°Р№РґРµРЅР°. РџСЂРёРјРµРЅРё Р°РєС‚СѓР°Р»СЊРЅС‹Рµ РјРёРіСЂР°С†РёРё.",
    };
  }

  return {
    status: 500,
    code: "VOTE_CREATE_FAILED",
    error: "РќРµ СѓРґР°Р»РѕСЃСЊ СЃРѕР·РґР°С‚СЊ РіРѕР»РѕСЃ.",
  };
}

export function buildVoteSuccessPayload(
  type: "up" | "down",
  row: CastVoteRow,
  commentPool: { up: readonly string[]; down: readonly string[] } = AI_COMMENTS,
) {
  const comments = type === "up" ? commentPool.up : commentPool.down;
  const aiComment = comments[Math.floor(Math.random() * comments.length)];

  return {
    comment: aiComment,
    newAuraChange: Number(row.aura_change || 0),
    limits: {
      regularUsed: Number(row.regular_votes_used || 0),
      regularLimit: VOTE_DAILY_LIMIT,
      anonymousUsed: Number(row.anonymous_votes_used || 0),
      anonymousLimit: ANONYMOUS_VOTE_DAILY_LIMIT,
    },
  };
}
