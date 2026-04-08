import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";

export interface ProfileModerationState {
  profile_id: string;
  is_limited: boolean;
  hide_from_discover: boolean;
  hide_from_leaderboards: boolean;
  reason: string | null;
  note: string | null;
  updated_at: string;
  updated_by: string | null;
}

export async function getProfileModerationStates(profileIds: string[]) {
  const uniqueIds = Array.from(new Set(profileIds.filter(Boolean)));

  if (!uniqueIds.length) {
    return new Map<string, ProfileModerationState>();
  }

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("profile_moderation_states")
    .select("profile_id, is_limited, hide_from_discover, hide_from_leaderboards, reason, note, updated_at, updated_by")
    .in("profile_id", uniqueIds);

  if (error) {
    throw new Error(error.message || "Failed to load moderation states");
  }

  return new Map(
    ((data || []) as ProfileModerationState[]).map((row) => [row.profile_id, row]),
  );
}

export async function getProfileModerationState(profileId: string) {
  const map = await getProfileModerationStates([profileId]);
  return map.get(profileId) ?? null;
}

export function isDiscoverVisible(state: ProfileModerationState | null | undefined) {
  return !state?.is_limited && !state?.hide_from_discover;
}

export function isLeaderboardVisible(state: ProfileModerationState | null | undefined) {
  return !state?.is_limited && !state?.hide_from_leaderboards;
}

export function isProfileLimited(state: ProfileModerationState | null | undefined) {
  return Boolean(state?.is_limited);
}
