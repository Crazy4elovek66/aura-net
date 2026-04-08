import crypto from "crypto";
import test from "node:test";
import assert from "node:assert/strict";

import {
  isSafeNextPath,
  normalizeReferralCode,
  parseTmaUser,
  parseWidgetUser,
} from "../../lib/auth/telegram-auth.ts";

function signTmaInitData(botToken, params) {
  const dataCheckString = Object.entries(params)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, value]) => `${key}=${value}`)
    .join("\n");

  const secretKey = crypto.createHmac("sha256", "WebAppData").update(botToken).digest();
  const hash = crypto.createHmac("sha256", secretKey).update(dataCheckString).digest("hex");
  const search = new URLSearchParams({ ...params, hash });
  return search.toString();
}

function signWidgetPayload(botToken, payload) {
  const dataCheckString = Object.keys(payload)
    .sort()
    .map((key) => `${key}=${payload[key]}`)
    .join("\n");

  const secretKey = crypto.createHash("sha256").update(botToken).digest();
  const hash = crypto.createHmac("sha256", secretKey).update(dataCheckString).digest("hex");
  return { ...payload, hash };
}

test("telegram TMA auth parser validates hash and extracts referral code source", () => {
  const botToken = "test-bot-token";
  const initData = signTmaInitData(botToken, {
    auth_date: "1712600000",
    start_param: "ref_inviter42",
    user: JSON.stringify({
      id: 42,
      first_name: "Aura",
      username: "aura_user",
      photo_url: "https://example.com/avatar.png",
    }),
  });

  assert.deepEqual(parseTmaUser({ initData }, botToken), {
    id: 42,
    first_name: "Aura",
    username: "aura_user",
    photo_url: "https://example.com/avatar.png",
    start_param: "ref_inviter42",
  });
});

test("telegram widget auth parser rejects invalid hash", () => {
  assert.throws(
    () =>
      parseWidgetUser(
        {
          id: "42",
          first_name: "Aura",
          username: "aura_user",
          hash: "broken",
        },
        "bot-token",
      ),
    /Invalid Widget hash/,
  );
});

test("telegram widget auth parser accepts signed payload", () => {
  const payload = signWidgetPayload("bot-token", {
    id: "42",
    first_name: "Aura",
    username: "aura_user",
    photo_url: "https://example.com/avatar.png",
  });

  assert.deepEqual(parseWidgetUser(payload, "bot-token"), {
    id: 42,
    first_name: "Aura",
    username: "aura_user",
    photo_url: "https://example.com/avatar.png",
  });
});

test("safe redirect and referral normalization guards stay strict", () => {
  assert.equal(isSafeNextPath("/profile"), true);
  assert.equal(isSafeNextPath("//evil.example"), false);
  assert.equal(normalizeReferralCode(" ref_demo "), "demo");
  assert.equal(normalizeReferralCode("   "), null);
});
