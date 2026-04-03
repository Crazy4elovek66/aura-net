export const VOTE_DAILY_LIMIT = 10;
export const ANONYMOUS_VOTE_DAILY_LIMIT = 2;
export const ANONYMOUS_VOTE_COST = 50;

export const BOOST_COST = 200;
export const BOOST_DURATION_MINUTES = 15;

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
