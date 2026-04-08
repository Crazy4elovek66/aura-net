export interface ClaimDailyRewardRow {
  claimed?: boolean;
  reward?: number;
  streak?: number;
  next_reward?: number;
  last_reward_at?: string | null;
  available_at?: string | null;
  base_reward?: number;
  bonus_reward?: number;
  streak_milestone_reward?: number;
  weekly_reward?: number;
  achievement_reward?: number;
  unlocked_achievements?: string[] | null;
}

export function mapDailyRewardRpcError(message: string) {
  const normalized = message.toLowerCase();
  const notFound = normalized.includes("profile not found");
  const fnMissing = normalized.includes("claim_daily_reward") && normalized.includes("function");
  const permissionError = normalized.includes("permission denied");

  return {
    status: notFound ? 404 : fnMissing ? 501 : permissionError ? 403 : 500,
    message: notFound
      ? "РџСЂРѕС„РёР»СЊ РЅРµ РЅР°Р№РґРµРЅ."
      : fnMissing
        ? "Р¤СѓРЅРєС†РёСЏ РµР¶РµРґРЅРµРІРЅРѕР№ РЅР°РіСЂР°РґС‹ РЅРµ РЅР°Р№РґРµРЅР° РІ Р±Р°Р·Рµ. РџСЂРёРјРµРЅРё Р°РєС‚СѓР°Р»СЊРЅС‹Рµ РјРёРіСЂР°С†РёРё."
        : permissionError
          ? "РќРµРґРѕСЃС‚Р°С‚РѕС‡РЅРѕ РїСЂР°РІ РґР»СЏ РїРѕР»СѓС‡РµРЅРёСЏ РµР¶РµРґРЅРµРІРЅРѕР№ РЅР°РіСЂР°РґС‹."
          : message || "РќРµ СѓРґР°Р»РѕСЃСЊ РїРѕР»СѓС‡РёС‚СЊ РµР¶РµРґРЅРµРІРЅСѓСЋ РЅР°РіСЂР°РґСѓ.",
    code: notFound
      ? "PROFILE_NOT_FOUND"
      : fnMissing
        ? "FUNCTION_MISSING"
        : permissionError
          ? "FORBIDDEN"
          : "DAILY_REWARD_FAILED",
  };
}

export function buildDailyRewardSuccessPayload(row: ClaimDailyRewardRow) {
  return {
    claimed: Boolean(row.claimed),
    reward: Number(row.reward || 0),
    streak: Number(row.streak || 0),
    nextReward: Number(row.next_reward || 0),
    lastRewardAt: row.last_reward_at ?? null,
    availableAt: row.available_at ?? null,
    baseReward: Number(row.base_reward || 0),
    bonusReward: Number(row.bonus_reward || 0),
    bonuses: {
      streakMilestone: Number(row.streak_milestone_reward || 0),
      weeklyActivity: Number(row.weekly_reward || 0),
      achievements: Number(row.achievement_reward || 0),
    },
    unlockedAchievements: Array.isArray(row.unlocked_achievements)
      ? row.unlocked_achievements.filter((item): item is string => typeof item === "string" && item.length > 0)
      : [],
  };
}
