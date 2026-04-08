import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import assert from "node:assert/strict";

import { hasRequiredRuntimeJobPayload, isRetryableDbError } from "../../lib/server/runtime-jobs-core.ts";

const repoRoot = path.resolve(import.meta.dirname, "../..");

function read(relativePath) {
  return fs.readFileSync(path.join(repoRoot, relativePath), "utf8");
}

test("runtime job payload validation rejects silent notification/referral breakage", () => {
  assert.equal(
    hasRequiredRuntimeJobPayload("enqueue_notification_event", {
      profileId: "user-1",
      eventType: "new_vote",
    }),
    true,
  );
  assert.equal(hasRequiredRuntimeJobPayload("enqueue_notification_event", { eventType: "new_vote" }), false);
  assert.equal(hasRequiredRuntimeJobPayload("activate_referral", { inviteeId: "user-1" }), true);
  assert.equal(hasRequiredRuntimeJobPayload("bind_referral", { inviteeId: "user-1" }), false);
});

test("runtime job retryability stays conservative for non-retryable DB errors", () => {
  assert.equal(isRetryableDbError("Not allowed to bind referral for another profile"), false);
  assert.equal(isRetryableDbError("Unsupported channel: sms"), false);
  assert.equal(isRetryableDbError("read ECONNRESET"), true);
});

test("schema guards preserve referral activation rules", () => {
  const schema = read("schema.sql");

  assert.match(schema, /create or replace function public\.activate_referral_if_eligible/);
  assert.match(schema, /waiting_first_claim/);
  assert.match(schema, /waiting_social_proof/);
  assert.match(schema, /voter_id <> v_referral\.inviter_id/);
  assert.match(schema, /target_id = p_invitee_id and v\.voter_id is not null and v\.voter_id <> v_referral\.inviter_id/);
});

test("schema guards preserve bind and notification dedupe rules", () => {
  const schema = read("schema.sql");

  assert.match(schema, /invite_window_expired/);
  assert.match(schema, /invitee_already_active/);
  assert.match(schema, /same_telegram_identity/);
  assert.match(schema, /duplicate_dedupe_key/);
  assert.match(schema, /telegram_disabled/);
  assert.match(schema, /telegram_id_missing/);
});

test("route source keeps critical moderation and public contract keys", () => {
  const voteRoute = read("app/api/vote/route.ts");
  const rewardRoute = read("app/api/daily-reward/route.ts");
  const discoverRoute = read("app/api/discover/route.ts");
  const leaderboardFullRoute = read("app/api/leaderboard/full/route.ts");
  const leaderboardPreviewRoute = read("app/api/leaderboard/preview/route.ts");

  assert.match(voteRoute, /PROFILE_LIMITED/);
  assert.match(voteRoute, /TARGET_PROFILE_LIMITED/);
  assert.match(voteRoute, /buildVoteSuccessPayloadForResponse|comment:/);

  assert.match(rewardRoute, /PROFILE_LIMITED/);
  assert.match(rewardRoute, /buildDailyRewardSuccessPayload|claimed:/);

  assert.match(discoverRoute, /generatedAt/);
  assert.match(discoverRoute, /sections:/);
  assert.match(leaderboardFullRoute, /tabs:/);
  assert.match(leaderboardFullRoute, /personalContext/);
  assert.match(leaderboardPreviewRoute, /auraLeaders/);
  assert.match(leaderboardPreviewRoute, /growthLeaders/);
  assert.match(leaderboardPreviewRoute, /spotlightLeaders/);
});
