export const VOTE_DAILY_LIMIT = 10;
export const ANONYMOUS_VOTE_DAILY_LIMIT = 2;
export const ANONYMOUS_VOTE_COST = 50;

export const SPOTLIGHT_COST = 200;
export const SPOTLIGHT_DURATION_MINUTES = 15;
export const BOOST_COST = SPOTLIGHT_COST;
export const BOOST_DURATION_MINUTES = SPOTLIGHT_DURATION_MINUTES;

export const DECAY_SHIELD_COST = 120;
export const DECAY_SHIELD_DURATION_HOURS = 24;

export const STREAK_RESCUE_COST = 90;
export const STREAK_RESCUE_COOLDOWN_HOURS = 168;

export const CARD_ACCENT_COST = 70;
export const CARD_ACCENT_DURATION_HOURS = 24;
export const CARD_ACCENT_VARIANTS = ["NEON_EDGE", "GOLD_PULSE", "FROST_RING"] as const;
export type CardAccentVariant = (typeof CARD_ACCENT_VARIANTS)[number];

export const DAILY_REWARD_BASE = 20;
export const DAILY_REWARD_STEP = 5;
export const DAILY_REWARD_CAP = 50;
export const STREAK_MILESTONE_REWARDS = [
  { days: 3, reward: 5 },
  { days: 7, reward: 10 },
  { days: 14, reward: 20 },
  { days: 30, reward: 40 },
] as const;
export const WEEKLY_ACTIVITY_TARGET_DAYS = 5;
export const WEEKLY_ACTIVITY_REWARD = 15;

export interface DailyRewardStatus {
  canClaim: boolean;
  claimedToday: boolean;
  currentStreak: number;
  projectedStreak: number;
  rewardToday: number;
  nextReward: number;
  availableAt: string;
  streakWillReset: boolean;
}

export interface StreakRescueStatus {
  canRescue: boolean;
  availableAt: string | null;
}

export function calculateDailyReward(streak: number): number {
  const safeStreak = Math.max(1, Math.floor(streak));
  return Math.min(DAILY_REWARD_BASE + (safeStreak - 1) * DAILY_REWARD_STEP, DAILY_REWARD_CAP);
}

export function getUtcDayWindow(now = new Date()) {
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
  return { start, end };
}

function getUtcDayStartMs(date: Date): number {
  return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
}

export function getStreakRescueStatus(
  dailyStreak: number,
  lastRewardAt: string | null,
  lastStreakSaveAt: string | null,
  now = new Date(),
): StreakRescueStatus {
  const safeStreak = Math.max(0, Math.floor(dailyStreak || 0));

  if (safeStreak <= 0 || !lastRewardAt) {
    return { canRescue: false, availableAt: null };
  }

  const todayStartMs = getUtcDayStartMs(now);
  const twoDaysAgoMs = todayStartMs - 2 * 24 * 60 * 60 * 1000;
  const lastRewardStartMs = getUtcDayStartMs(new Date(lastRewardAt));

  if (lastRewardStartMs !== twoDaysAgoMs) {
    return { canRescue: false, availableAt: null };
  }

  if (!lastStreakSaveAt) {
    return { canRescue: true, availableAt: null };
  }

  const cooldownUntilMs =
    new Date(lastStreakSaveAt).getTime() + STREAK_RESCUE_COOLDOWN_HOURS * 60 * 60 * 1000;

  if (cooldownUntilMs > now.getTime()) {
    return { canRescue: false, availableAt: new Date(cooldownUntilMs).toISOString() };
  }

  return { canRescue: true, availableAt: null };
}

export function getDailyRewardStatus(dailyStreak: number, lastRewardAt: string | null, now = new Date()): DailyRewardStatus {
  const safeStreak = Math.max(0, Math.floor(dailyStreak || 0));
  const todayStartMs = getUtcDayStartMs(now);
  const tomorrowStartMs = todayStartMs + 24 * 60 * 60 * 1000;

  if (!lastRewardAt) {
    return {
      canClaim: true,
      claimedToday: false,
      currentStreak: safeStreak,
      projectedStreak: 1,
      rewardToday: calculateDailyReward(1),
      nextReward: calculateDailyReward(2),
      availableAt: now.toISOString(),
      streakWillReset: safeStreak > 0,
    };
  }

  const lastRewardDate = new Date(lastRewardAt);
  const lastStartMs = getUtcDayStartMs(lastRewardDate);

  if (lastStartMs >= todayStartMs) {
    return {
      canClaim: false,
      claimedToday: true,
      currentStreak: safeStreak,
      projectedStreak: safeStreak + 1,
      rewardToday: 0,
      nextReward: calculateDailyReward(safeStreak + 1),
      availableAt: new Date(tomorrowStartMs).toISOString(),
      streakWillReset: false,
    };
  }

  const yesterdayStartMs = todayStartMs - 24 * 60 * 60 * 1000;
  const isStreakContinues = lastStartMs === yesterdayStartMs;
  const projectedStreak = isStreakContinues ? safeStreak + 1 : 1;

  return {
    canClaim: true,
    claimedToday: false,
    currentStreak: safeStreak,
    projectedStreak,
    rewardToday: calculateDailyReward(projectedStreak),
    nextReward: calculateDailyReward(projectedStreak + 1),
    availableAt: now.toISOString(),
    streakWillReset: !isStreakContinues && safeStreak > 0,
  };
}

