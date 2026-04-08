import "server-only";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  getProfileModerationStates,
  isDiscoverVisible,
  isLeaderboardVisible,
  type ProfileModerationState,
} from "@/lib/server/profile-moderation";
import { notFound, redirect } from "next/navigation";

interface BasicProfileRow {
  id: string;
  username: string;
  display_name: string | null;
  aura_points: number;
  created_at: string;
  telegram_id?: number | null;
  special_card?: string | null;
}

interface VoteRow {
  voter_id: string | null;
  target_id: string;
  is_anonymous: boolean;
  created_at: string;
}

interface NotificationRow {
  id: string;
  profile_id: string;
  error_message: string | null;
  event_type: string;
  created_at: string;
}

interface OpsEventRow {
  id: string;
  level: "info" | "warn" | "error" | "critical";
  scope: string;
  event_type: string;
  profile_id: string | null;
  actor_id: string | null;
  request_path: string | null;
  message: string | null;
  payload: Record<string, unknown>;
  created_at: string;
}

type ModerationRow = ProfileModerationState;

interface BoostRow {
  profile_id: string;
  expires_at: string;
}

function displayName(profile: Pick<BasicProfileRow, "display_name" | "username">) {
  return profile.display_name || profile.username;
}

function countDistinct(values: Array<string | null | undefined>) {
  return new Set(values.filter((value): value is string => Boolean(value))).size;
}

export async function requirePlatformAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?next=/admin");
  }

  const { data: isAdmin, error } = await supabase.rpc("is_platform_admin");

  if (error || !isAdmin) {
    notFound();
  }

  return { supabase, user };
}

export async function loadAdminOpsSnapshot() {
  const admin = createAdminClient();
  const now = new Date();
  const last24hIso = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
  const last7dIso = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();

  const [
    profilesCountResult,
    newProfiles24hResult,
    votes24hResult,
    rewards24hResult,
    pendingNotificationsResult,
    failedNotifications24hResult,
    pendingRuntimeJobsResult,
    failedRuntimeJobs24hResult,
    criticalEvents24hResult,
    limitedProfilesCountResult,
    discoverHiddenCountResult,
    leaderboardHiddenCountResult,
    specialCardsCountResult,
    activeBoostsResult,
    recentProfilesResult,
    recentVotesResult,
    failedNotificationsResult,
    recentOpsEventsResult,
    moderationStatesResult,
    duplicateTelegramProfilesResult,
    specialCardProfilesResult,
  ] = await Promise.all([
    admin.from("profiles").select("id", { count: "exact", head: true }),
    admin.from("profiles").select("id", { count: "exact", head: true }).gte("created_at", last24hIso),
    admin.from("votes").select("id", { count: "exact", head: true }).gte("created_at", last24hIso),
    admin.from("transactions").select("id", { count: "exact", head: true }).eq("type", "daily_reward").gte("created_at", last24hIso),
    admin.from("notification_events").select("id", { count: "exact", head: true }).eq("status", "pending"),
    admin.from("notification_events").select("id", { count: "exact", head: true }).eq("status", "failed").gte("created_at", last24hIso),
    admin.from("runtime_jobs").select("id", { count: "exact", head: true }).eq("status", "pending"),
    admin.from("runtime_jobs").select("id", { count: "exact", head: true }).eq("status", "failed").gte("created_at", last24hIso),
    admin
      .from("ops_events")
      .select("id", { count: "exact", head: true })
      .gte("created_at", last24hIso)
      .in("level", ["error", "critical"]),
    admin.from("profile_moderation_states").select("profile_id", { count: "exact", head: true }).eq("is_limited", true),
    admin.from("profile_moderation_states").select("profile_id", { count: "exact", head: true }).eq("hide_from_discover", true),
    admin.from("profile_moderation_states").select("profile_id", { count: "exact", head: true }).eq("hide_from_leaderboards", true),
    admin.from("profiles").select("id", { count: "exact", head: true }).not("special_card", "is", null),
    admin.from("boosts").select("profile_id, expires_at").gt("expires_at", now.toISOString()).order("expires_at", { ascending: false }).limit(25),
    admin.from("profiles").select("id, username, display_name, aura_points, created_at, telegram_id, special_card").order("created_at", { ascending: false }).limit(60),
    admin.from("votes").select("voter_id, target_id, is_anonymous, created_at").gte("created_at", last24hIso).order("created_at", { ascending: false }).limit(500),
    admin
      .from("notification_events")
      .select("id, profile_id, error_message, event_type, created_at")
      .eq("status", "failed")
      .gte("created_at", last7dIso)
      .order("created_at", { ascending: false })
      .limit(120),
    admin
      .from("ops_events")
      .select("id, level, scope, event_type, profile_id, actor_id, request_path, message, payload, created_at")
      .order("created_at", { ascending: false })
      .limit(25),
    admin
      .from("profile_moderation_states")
      .select("profile_id, is_limited, hide_from_discover, hide_from_leaderboards, reason, note, updated_at, updated_by")
      .order("updated_at", { ascending: false })
      .limit(30),
    admin
      .from("profiles")
      .select("id, username, display_name, telegram_id, created_at, aura_points")
      .not("telegram_id", "is", null)
      .order("created_at", { ascending: false })
      .limit(250),
    admin
      .from("profiles")
      .select("id, username, display_name, aura_points, created_at, special_card")
      .not("special_card", "is", null)
      .order("created_at", { ascending: false })
      .limit(25),
  ]);

  const failedResult = [
    profilesCountResult,
    newProfiles24hResult,
    votes24hResult,
    rewards24hResult,
    pendingNotificationsResult,
    failedNotifications24hResult,
    pendingRuntimeJobsResult,
    failedRuntimeJobs24hResult,
    criticalEvents24hResult,
    limitedProfilesCountResult,
    discoverHiddenCountResult,
    leaderboardHiddenCountResult,
    specialCardsCountResult,
    activeBoostsResult,
    recentProfilesResult,
    recentVotesResult,
    failedNotificationsResult,
    recentOpsEventsResult,
    moderationStatesResult,
    duplicateTelegramProfilesResult,
    specialCardProfilesResult,
  ].find((result) => "error" in result && result.error);

  if (failedResult && "error" in failedResult && failedResult.error) {
    throw new Error(failedResult.error.message || "Failed to load admin ops snapshot");
  }

  const profiles = (recentProfilesResult.data || []) as BasicProfileRow[];
  const profileMap = new Map(profiles.map((profile) => [profile.id, profile]));
  const duplicateProfileRows = (duplicateTelegramProfilesResult.data || []) as BasicProfileRow[];
  for (const row of duplicateProfileRows) {
    if (!profileMap.has(row.id)) {
      profileMap.set(row.id, row);
    }
  }
  const specialCardRows = (specialCardProfilesResult.data || []) as BasicProfileRow[];
  for (const row of specialCardRows) {
    if (!profileMap.has(row.id)) {
      profileMap.set(row.id, row);
    }
  }

  const moderationStates = (moderationStatesResult.data || []) as ModerationRow[];
  const recentOpsEvents = (recentOpsEventsResult.data || []) as OpsEventRow[];
  const failedNotifications = (failedNotificationsResult.data || []) as NotificationRow[];
  const recentVotes = (recentVotesResult.data || []) as VoteRow[];
  const activeBoosts = (activeBoostsResult.data || []) as BoostRow[];

  const supplementalProfileIds = Array.from(
    new Set([
      ...recentVotes.map((vote) => vote.target_id),
      ...recentVotes.map((vote) => vote.voter_id).filter((value): value is string => Boolean(value)),
      ...failedNotifications.map((row) => row.profile_id),
      ...recentOpsEvents.map((event) => event.profile_id).filter((value): value is string => Boolean(value)),
      ...moderationStates.map((row) => row.profile_id),
      ...activeBoosts.map((row) => row.profile_id),
    ]),
  ).filter((id) => !profileMap.has(id));

  if (supplementalProfileIds.length) {
    const { data: supplementalProfiles, error: supplementalProfilesError } = await admin
      .from("profiles")
      .select("id, username, display_name, aura_points, created_at, telegram_id, special_card")
      .in("id", supplementalProfileIds);

    if (supplementalProfilesError) {
      throw new Error(supplementalProfilesError.message || "Failed to load supplemental admin profiles");
    }

    for (const row of (supplementalProfiles || []) as BasicProfileRow[]) {
      if (!profileMap.has(row.id)) {
        profileMap.set(row.id, row);
      }
    }
  }

  const recentProfileIds = Array.from(new Set([
    ...profiles.map((profile) => profile.id),
    ...failedNotifications.map((row) => row.profile_id),
    ...moderationStates.map((row) => row.profile_id),
    ...activeBoosts.map((row) => row.profile_id),
  ]));
  const recentModerationMap = await getProfileModerationStates(recentProfileIds);

  const activeBoostMap = new Map(activeBoosts.map((row) => [row.profile_id, row.expires_at]));

  const visibleRecentProfiles = profiles.filter((profile) => isDiscoverVisible(recentModerationMap.get(profile.id)));

  const voteTargets = new Map<string, { total: number; anonymous: number; uniqueVoters: Set<string> }>();
  const anonymousVoters = new Map<string, { total: number; uniqueTargets: Set<string> }>();
  for (const vote of recentVotes) {
    const targetBucket = voteTargets.get(vote.target_id) || { total: 0, anonymous: 0, uniqueVoters: new Set<string>() };
    targetBucket.total += 1;
    if (vote.is_anonymous) {
      targetBucket.anonymous += 1;
    }
    if (vote.voter_id) {
      targetBucket.uniqueVoters.add(vote.voter_id);
    }
    voteTargets.set(vote.target_id, targetBucket);

    if (vote.is_anonymous && vote.voter_id) {
      const voterBucket = anonymousVoters.get(vote.voter_id) || { total: 0, uniqueTargets: new Set<string>() };
      voterBucket.total += 1;
      voterBucket.uniqueTargets.add(vote.target_id);
      anonymousVoters.set(vote.voter_id, voterBucket);
    }
  }

  const failedNotificationsByProfile = new Map<string, number>();
  for (const notification of failedNotifications) {
    failedNotificationsByProfile.set(
      notification.profile_id,
      (failedNotificationsByProfile.get(notification.profile_id) || 0) + 1,
    );
  }

  const duplicateTelegramGroups = new Map<string, BasicProfileRow[]>();
  for (const profile of duplicateProfileRows) {
    const telegramId = profile.telegram_id;
    if (!telegramId) {
      continue;
    }

    const key = String(telegramId);
    const bucket = duplicateTelegramGroups.get(key) || [];
    bucket.push(profile);
    duplicateTelegramGroups.set(key, bucket);
  }

  const suspiciousProfiles = [
    ...Array.from(voteTargets.entries())
      .filter(([, bucket]) => bucket.total >= 8 || bucket.anonymous >= 4)
      .map(([profileId, bucket]) => {
        const profile = profileMap.get(profileId);
        if (!profile) return null;

        return {
          id: profile.id,
          username: profile.username,
          displayName: displayName(profile),
          auraPoints: profile.aura_points,
          reason: bucket.anonymous >= 4 ? "Anonymous vote burst" : "High vote velocity",
          score: bucket.total + bucket.anonymous,
          details: `${bucket.total} votes / 24h, ${bucket.anonymous} anonymous, ${bucket.uniqueVoters.size} distinct voters`,
          moderation: recentModerationMap.get(profile.id) || null,
        };
      }),
    ...Array.from(anonymousVoters.entries())
      .filter(([, bucket]) => bucket.total >= 4)
      .map(([profileId, bucket]) => {
        const profile = profileMap.get(profileId);
        if (!profile) return null;

        return {
          id: profile.id,
          username: profile.username,
          displayName: displayName(profile),
          auraPoints: profile.aura_points,
          reason: "Aggressive anonymous voting",
          score: bucket.total,
          details: `${bucket.total} anonymous votes / 24h across ${bucket.uniqueTargets.size} targets`,
          moderation: recentModerationMap.get(profile.id) || null,
        };
      }),
    ...Array.from(failedNotificationsByProfile.entries())
      .filter(([, count]) => count >= 3)
      .map(([profileId, count]) => {
        const profile = profileMap.get(profileId);
        if (!profile) return null;

        return {
          id: profile.id,
          username: profile.username,
          displayName: displayName(profile),
          auraPoints: profile.aura_points,
          reason: "Repeated notification failures",
          score: count,
          details: `${count} failed deliveries in the last 7 days`,
          moderation: recentModerationMap.get(profile.id) || null,
        };
      }),
    ...Array.from(duplicateTelegramGroups.entries())
      .filter(([, bucket]) => bucket.length > 1)
      .flatMap(([, bucket]) =>
        bucket.map((profile) => ({
          id: profile.id,
          username: profile.username,
          displayName: displayName(profile),
          auraPoints: profile.aura_points,
          reason: "Shared Telegram identity",
          score: bucket.length,
          details: `${bucket.length} profiles share the same telegram_id`,
          moderation: recentModerationMap.get(profile.id) || null,
        })),
      ),
  ]
    .filter((item): item is NonNullable<typeof item> => item !== null)
    .sort((left, right) => right.score - left.score)
    .slice(0, 12);

  const moderatedProfiles = moderationStates.map((state) => {
    const profile = profileMap.get(state.profile_id);
    return {
      id: state.profile_id,
      username: profile?.username || state.profile_id.slice(0, 8),
      displayName: profile ? displayName(profile) : state.profile_id.slice(0, 8),
      auraPoints: profile?.aura_points || 0,
      isLimited: state.is_limited,
      hideFromDiscover: state.hide_from_discover,
      hideFromLeaderboards: state.hide_from_leaderboards,
      reason: state.reason,
      note: state.note,
      updatedAt: state.updated_at,
      activeBoostUntil: activeBoostMap.get(state.profile_id) || null,
    };
  });

  const specialCardProfiles = specialCardRows.map((profile) => ({
    id: profile.id,
    username: profile.username,
    displayName: displayName(profile),
    auraPoints: profile.aura_points,
    specialCard: profile.special_card || "UNKNOWN",
    activeBoostUntil: activeBoostMap.get(profile.id) || null,
    moderation: recentModerationMap.get(profile.id) || null,
  }));

  return {
    generatedAt: now.toISOString(),
    numbers: {
      totalProfiles: Number(profilesCountResult.count || 0),
      newProfiles24h: Number(newProfiles24hResult.count || 0),
      votes24h: Number(votes24hResult.count || 0),
      rewards24h: Number(rewards24hResult.count || 0),
      pendingNotifications: Number(pendingNotificationsResult.count || 0),
      failedNotifications24h: Number(failedNotifications24hResult.count || 0),
      pendingRuntimeJobs: Number(pendingRuntimeJobsResult.count || 0),
      failedRuntimeJobs24h: Number(failedRuntimeJobs24hResult.count || 0),
      limitedProfiles: Number(limitedProfilesCountResult.count || 0),
      hiddenFromDiscover: Number(discoverHiddenCountResult.count || 0),
      hiddenFromLeaderboards: Number(leaderboardHiddenCountResult.count || 0),
      specialCards: Number(specialCardsCountResult.count || 0),
      activeBoosts: countDistinct(activeBoosts.map((row) => row.profile_id)),
      criticalEvents24h: Number(criticalEvents24hResult.count || 0),
    },
    recentProfiles: visibleRecentProfiles.slice(0, 10).map((profile) => ({
      id: profile.id,
      username: profile.username,
      displayName: displayName(profile),
      auraPoints: profile.aura_points,
      createdAt: profile.created_at,
      activeBoostUntil: activeBoostMap.get(profile.id) || null,
      moderation: recentModerationMap.get(profile.id) || null,
    })),
    suspiciousProfiles,
    moderatedProfiles,
    specialCardProfiles,
    failedNotifications: failedNotifications.slice(0, 10).map((row) => {
      const profile = profileMap.get(row.profile_id);
      return {
        id: row.id,
        profileId: row.profile_id,
        username: profile?.username || row.profile_id.slice(0, 8),
        displayName: profile ? displayName(profile) : row.profile_id.slice(0, 8),
        eventType: row.event_type,
        errorMessage: row.error_message,
        createdAt: row.created_at,
      };
    }),
    recentEvents: recentOpsEvents.map((event) => {
      const profile = event.profile_id ? profileMap.get(event.profile_id) : null;
      return {
        id: event.id,
        level: event.level,
        scope: event.scope,
        eventType: event.event_type,
        requestPath: event.request_path,
        message: event.message,
        createdAt: event.created_at,
        profile: profile
          ? {
              id: profile.id,
              username: profile.username,
              displayName: displayName(profile),
            }
          : null,
      };
    }),
    visibilitySummary: {
      discoverVisibleRecentProfiles: visibleRecentProfiles.length,
      leaderboardVisibleRecentProfiles: profiles.filter((profile) => isLeaderboardVisible(recentModerationMap.get(profile.id))).length,
    },
  };
}
