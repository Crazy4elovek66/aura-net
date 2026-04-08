const checks = [
  "Telegram auth: widget/TMA login, redirect only to safe internal path, referral ref_ code normalized.",
  "Vote route: unauthorized, limited profile blocked, limited target blocked, success response has success/comment/newAuraChange/limits.",
  "Daily reward: unauthorized, limited profile blocked, success response has claimed/reward/streak/bonuses/unlockedAchievements.",
  "Referral bind: empty code skips safely, valid code returns success payload, activation still requires first claim + social proof.",
  "Moderation: limit action blocks sensitive flows; discover/leaderboard hidden states do not leak into public lists.",
  "Notifications/runtime: drain route secret works, enqueue fallback paths do not silently accept invalid payloads.",
  "Public API contracts: discover and leaderboard responses keep generatedAt/sections|tabs/personalContext shape.",
];

console.log("Manual QA smoke hooks for critical Aura.net flows:");
for (const line of checks) {
  console.log(`- ${line}`);
}
