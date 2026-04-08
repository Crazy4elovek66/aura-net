export type RuntimeJobContractType =
  | "enqueue_notification_event"
  | "sync_leaderboard_presence"
  | "refresh_weekly_titles"
  | "emit_weekly_title_moments"
  | "activate_referral"
  | "bind_referral";

export function asString(value: unknown) {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

export function isRetryableDbError(message: string) {
  const normalized = message.toLowerCase();

  if (
    normalized.includes("not allowed") ||
    normalized.includes("profile not found") ||
    normalized.includes("invitee id is required") ||
    normalized.includes("unsupported channel") ||
    normalized.includes("invalid")
  ) {
    return false;
  }

  return true;
}

export function hasRequiredRuntimeJobPayload(
  jobType: RuntimeJobContractType,
  payload: Record<string, unknown> | null | undefined,
) {
  const data = payload || {};

  switch (jobType) {
    case "enqueue_notification_event":
      return Boolean(asString(data.profileId) && asString(data.eventType));
    case "sync_leaderboard_presence":
      return Boolean(asString(data.profileId));
    case "refresh_weekly_titles":
    case "emit_weekly_title_moments":
      return true;
    case "activate_referral":
      return Boolean(asString(data.inviteeId));
    case "bind_referral":
      return Boolean(asString(data.inviteeId) && asString(data.inviteCode));
  }
}
