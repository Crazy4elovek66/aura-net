import test from "node:test";
import assert from "node:assert/strict";

import { buildDailyRewardSuccessPayload, mapDailyRewardRpcError } from "../../lib/server/daily-reward-flow.ts";
import { buildVoteSuccessPayload, mapVoteRpcError } from "../../lib/server/vote-flow.ts";

test("vote RPC errors map to stable response codes", () => {
  assert.deepEqual(mapVoteRpcError("already voted today"), {
    status: 400,
    code: "ALREADY_VOTED",
    error: "РўС‹ СѓР¶Рµ РіРѕР»РѕСЃРѕРІР°Р» Р·Р° СЌС‚РѕС‚ РїСЂРѕС„РёР»СЊ.",
  });

  assert.equal(mapVoteRpcError("anonymous vote daily limit reached").code, "ANONYMOUS_DAILY_LIMIT_REACHED");
  assert.equal(mapVoteRpcError("function cast_profile_vote does not exist").status, 501);
  assert.equal(mapVoteRpcError("unexpected").code, "VOTE_CREATE_FAILED");
});

test("vote success payload keeps critical response shape", () => {
  const payload = buildVoteSuccessPayload("up", {
    aura_change: 7,
    regular_votes_used: 2,
    anonymous_votes_used: 1,
  });

  assert.equal(typeof payload.comment, "string");
  assert.equal(payload.newAuraChange, 7);
  assert.deepEqual(Object.keys(payload.limits), [
    "regularUsed",
    "regularLimit",
    "anonymousUsed",
    "anonymousLimit",
  ]);
});

test("daily reward RPC errors map to stable response codes", () => {
  assert.deepEqual(mapDailyRewardRpcError("Profile not found for id 1"), {
    status: 404,
    message: "РџСЂРѕС„РёР»СЊ РЅРµ РЅР°Р№РґРµРЅ.",
    code: "PROFILE_NOT_FOUND",
  });

  assert.equal(mapDailyRewardRpcError("permission denied").code, "FORBIDDEN");
  assert.equal(mapDailyRewardRpcError("claim_daily_reward function does not exist").status, 501);
});

test("daily reward success payload keeps economy response shape", () => {
  const payload = buildDailyRewardSuccessPayload({
    claimed: true,
    reward: 25,
    streak: 4,
    next_reward: 30,
    last_reward_at: "2026-04-09T00:00:00.000Z",
    available_at: "2026-04-10T00:00:00.000Z",
    base_reward: 10,
    bonus_reward: 15,
    streak_milestone_reward: 5,
    weekly_reward: 7,
    achievement_reward: 3,
    unlocked_achievements: ["streak_3", "", "weekly_1"],
  });

  assert.equal(payload.claimed, true);
  assert.equal(payload.reward, 25);
  assert.deepEqual(Object.keys(payload.bonuses), ["streakMilestone", "weeklyActivity", "achievements"]);
  assert.deepEqual(payload.unlockedAchievements, ["streak_3", "weekly_1"]);
});
