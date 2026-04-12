import { getDailyRewardStatus } from "@/lib/economy";
import {
  API_ERROR_MESSAGES,
  buildApiErrorResponse,
  buildApiSuccessResponse,
} from "@/lib/server/route-response";
import { createClient } from "@/lib/supabase/server";
import { headers } from "next/headers";
import {
  type CircleTabPayload,
  type HistoryTabPayload,
  type ProgressTabPayload,
  type ReferralEntry,
} from "@/app/profile/profile-tab-data";
import { normalizeProfileTab } from "@/app/profile/profile-tabs";

interface ProfileRow {
  id: string;
  username: string;
  display_name: string | null;
  aura_points: number;
  daily_streak: number;
  last_reward_at: string | null;
  referred_by: string | null;
  invite_code: string | null;
}

interface ReferralRow {
  id: string;
  invitee_id: string;
  status: "pending" | "activated" | "rejected";
  joined_at: string;
  activated_at: string | null;
  inviter_reward: number;
  invitee_reward: number;
}

interface InviteeProfileRow {
  id: string;
  username: string;
  display_name: string | null;
}

interface InviteeClaimRow {
  user_id: string;
}

interface ProfileLeaderboardContextRow {
  profile_id: string;
  rank_position: number | string;
  distance_to_next: number;
  distance_to_top_target: number;
  above_profile_id: string | null;
  above_username: string | null;
  above_display_name: string | null;
  above_aura_points: number | null;
  below_profile_id: string | null;
  below_username: string | null;
  below_display_name: string | null;
  below_aura_points: number | null;
}

interface WeeklyTitleRow {
  title_key: string;
  title: string;
  profile_id: string;
}

interface PresenceStateRow {
  last_rank: number | null;
  updated_at: string;
}

interface CircleProfileRow {
  id: string;
  username: string;
  display_name: string | null;
  aura_points: number;
}

interface GrowthLeaderRow {
  user_id: string;
  username: string;
  display_name: string;
  aura_points: number;
  growth_points: number;
}

interface SpotlightRow {
  profile_id: string;
  expires_at: string;
}

interface SpotlightProfileRow {
  id: string;
  username: string;
  display_name: string | null;
  aura_points: number;
}

interface NotificationEventRow {
  id: string;
  event_type: string;
  status: string;
  created_at: string;
  scheduled_for: string;
  payload?: Record<string, unknown>;
}

const WEEKLY_TITLE_LABELS: Record<string, string> = {
  weekly_aura_champion: "Чемп ауры",
  weekly_rise_rocket: "Ракета роста",
  weekly_hype_pulse: "Пульс хайпа",
};

function asNumber(value: number | string | null | undefined): number {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : 0;
  }

  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function resolveOrigin(headerStore: Headers, fallbackOrigin: string | null): string {
  if (fallbackOrigin) {
    return fallbackOrigin;
  }

  const forwardedHost = headerStore.get("x-forwarded-host");
  const forwardedProto = headerStore.get("x-forwarded-proto");
  const host = forwardedHost || headerStore.get("host");
  const protocol = forwardedProto || (process.env.NODE_ENV === "development" ? "http" : "https");

  return host ? `${protocol}://${host}` : "";
}

async function loadReferralEntries(supabase: Awaited<ReturnType<typeof createClient>>, userId: string): Promise<ReferralEntry[]> {
  const referralsResult = await supabase
    .from("referrals")
    .select("id, invitee_id, status, joined_at, activated_at, inviter_reward, invitee_reward")
    .eq("inviter_id", userId)
    .order("joined_at", { ascending: false })
    .limit(12);

  if (referralsResult.error) {
    console.error("[Profile Tabs API] Failed to load referrals", referralsResult.error.message);
    return [];
  }

  const referralRows = (referralsResult.data as ReferralRow[] | null) || [];
  const inviteeIds = referralRows.map((row) => row.invitee_id);
  const [inviteeProfilesResult, inviteeClaimsResult] = await Promise.all([
    inviteeIds.length
      ? supabase.from("profiles").select("id, username, display_name").in("id", inviteeIds)
      : Promise.resolve({ data: [] as InviteeProfileRow[] }),
    inviteeIds.length
      ? supabase.from("transactions").select("user_id").in("user_id", inviteeIds).eq("type", "daily_reward")
      : Promise.resolve({ data: [] as InviteeClaimRow[] }),
  ]);

  if ("error" in inviteeProfilesResult && inviteeProfilesResult.error) {
    console.error("[Profile Tabs API] Failed to load invitee profiles", inviteeProfilesResult.error.message);
  }

  if ("error" in inviteeClaimsResult && inviteeClaimsResult.error) {
    console.error("[Profile Tabs API] Failed to load invitee claim state", inviteeClaimsResult.error.message);
  }

  const inviteeProfileMap = new Map(
    (((inviteeProfilesResult.data as InviteeProfileRow[] | null) || []) as InviteeProfileRow[]).map((row) => [row.id, row]),
  );
  const inviteeFirstClaimSet = new Set(
    (((inviteeClaimsResult.data as InviteeClaimRow[] | null) || []) as InviteeClaimRow[]).map((row) => row.user_id),
  );

  return referralRows.map((row) => {
    const invitee = inviteeProfileMap.get(row.invitee_id);

    return {
      id: row.id,
      inviteeId: row.invitee_id,
      inviteeUsername: invitee?.username || null,
      inviteeDisplayName: invitee?.display_name || invitee?.username || `Профиль ${row.invitee_id.slice(0, 6)}`,
      status: row.status,
      joinedAt: row.joined_at,
      activatedAt: row.activated_at,
      inviterReward: Number(row.inviter_reward || 0),
      inviteeReward: Number(row.invitee_reward || 0),
      hasFirstClaim: inviteeFirstClaimSet.has(row.invitee_id),
    };
  });
}

async function loadProgressPayload(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  profile: ProfileRow,
  profileShareLink: string,
  inviteLink: string | null,
): Promise<ProgressTabPayload> {
  const [raceContextResult, weeklyTitlesResult, presenceStateResult, referralEntries, votesCastResult] = await Promise.all([
    supabase.rpc("get_profile_leaderboard_context", { p_profile_id: userId, p_top_target: 10 }).maybeSingle(),
    supabase.rpc("get_active_weekly_titles", { p_limit: 12 }),
    supabase.from("leaderboard_presence_states").select("last_rank, updated_at").eq("profile_id", userId).maybeSingle(),
    loadReferralEntries(supabase, userId),
    supabase.from("votes").select("id", { count: "exact", head: true }).eq("voter_id", userId),
  ]);

  const raceContextRaw = (raceContextResult.data || null) as ProfileLeaderboardContextRow | null;
  const raceContext = raceContextRaw
    ? {
        profileId: raceContextRaw.profile_id,
        rank: asNumber(raceContextRaw.rank_position),
        distanceToNext: asNumber(raceContextRaw.distance_to_next),
        distanceToTop10: asNumber(raceContextRaw.distance_to_top_target),
        above: raceContextRaw.above_profile_id
          ? {
              id: raceContextRaw.above_profile_id,
              username: raceContextRaw.above_username || "",
              displayName: raceContextRaw.above_display_name || raceContextRaw.above_username || "",
              auraPoints: asNumber(raceContextRaw.above_aura_points),
            }
          : null,
        below: raceContextRaw.below_profile_id
          ? {
              id: raceContextRaw.below_profile_id,
              username: raceContextRaw.below_username || "",
              displayName: raceContextRaw.below_display_name || raceContextRaw.below_username || "",
              auraPoints: asNumber(raceContextRaw.below_aura_points),
            }
          : null,
      }
    : null;

  const weeklyTitles = ((weeklyTitlesResult.data as WeeklyTitleRow[] | null) || [])
    .filter((row) => row.profile_id === userId)
    .map((row) => ({
      key: row.title_key,
      title: WEEKLY_TITLE_LABELS[row.title_key] || row.title,
    }));

  const presenceState = (presenceStateResult.data as PresenceStateRow | null) || null;
  const trackedAt = presenceState?.updated_at ?? null;

  const [transactionsSinceTrackedResult, achievementsSinceTrackedResult, momentsSinceTrackedResult, pendingEventsResult] = trackedAt
    ? await Promise.all([
        supabase.from("transactions").select("amount").eq("user_id", userId).gt("created_at", trackedAt),
        supabase
          .from("user_achievements")
          .select("achievement_key", { count: "exact", head: true })
          .eq("user_id", userId)
          .gt("unlocked_at", trackedAt),
        supabase
          .from("shareable_moments")
          .select("id", { count: "exact", head: true })
          .eq("profile_id", userId)
          .gt("created_at", trackedAt),
        supabase
          .from("notification_events")
          .select("id", { count: "exact", head: true })
          .eq("profile_id", userId)
          .in("status", ["pending", "processing"]),
      ])
    : [{ data: [] as Array<{ amount: number }> }, { count: 0 }, { count: 0 }, { count: 0 }];

  const auraDeltaSinceTracked = trackedAt
    ? (((transactionsSinceTrackedResult.data as Array<{ amount: number }> | null) || []) as Array<{ amount: number }>).reduce(
        (sum, row) => sum + Number(row.amount || 0),
        0,
      )
    : 0;

  const newMomentsSinceTracked = trackedAt ? Number(momentsSinceTrackedResult.count || 0) : 0;
  const pendingEvents = trackedAt ? Number(pendingEventsResult.count || 0) : 0;
  const newAchievementsSinceTracked = trackedAt ? Number(achievementsSinceTrackedResult.count || 0) : 0;
  const activatedReferralsSinceTracked = trackedAt
    ? referralEntries.filter((entry) => entry.activatedAt && entry.activatedAt > trackedAt).length
    : 0;

  const pendingInvites = referralEntries.filter((entry) => entry.status === "pending").length;
  const activatedInvites = referralEntries.filter((entry) => entry.status === "activated").length;

  const dailyRewardState = getDailyRewardStatus(profile.daily_streak, profile.last_reward_at);

  return {
    raceContext,
    weeklyTitles,
    trackedAt,
    currentRank: raceContext?.rank ?? null,
    previousRank: presenceState?.last_rank ?? null,
    auraDelta: auraDeltaSinceTracked,
    newAchievements: newAchievementsSinceTracked,
    newMoments: newMomentsSinceTracked,
    activatedReferrals: activatedReferralsSinceTracked,
    pendingEvents,
    nextSteps: {
      auraPoints: Number(profile.aura_points || 0),
      dailyStreak: Number(profile.daily_streak || 0),
      claimedToday: dailyRewardState.claimedToday,
      activatedInvites,
      pendingInvites,
      votesCast: Number(votesCastResult.count || 0),
      profileShareLink,
      inviteLink,
    },
  };
}

async function loadCirclePayload(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  profile: ProfileRow,
  profileShareLink: string,
  webInviteLink: string | null,
  telegramInviteLink: string | null,
): Promise<CircleTabPayload> {
  const [referralEntries, shareableMomentsResult] = await Promise.all([
    loadReferralEntries(supabase, userId),
    supabase
      .from("shareable_moments")
      .select("id, moment_type, payload, created_at")
      .eq("profile_id", userId)
      .order("created_at", { ascending: false })
      .limit(6),
  ]);

  const circleIds = Array.from(
    new Set([userId, ...(profile.referred_by ? [profile.referred_by] : []), ...referralEntries.map((entry) => entry.inviteeId)]),
  );

  const circleProfilesResult = circleIds.length
    ? await supabase.from("profiles").select("id, username, display_name, aura_points").in("id", circleIds)
    : { data: [] as CircleProfileRow[] };

  const circleProfiles = ((circleProfilesResult.data as CircleProfileRow[] | null) || [])
    .map((row) => {
      let relation: "you" | "invited" | "invited_you" = "invited";
      let relationLabel = "твой человек";

      if (row.id === userId) {
        relation = "you";
        relationLabel = "это ты";
      } else if (profile.referred_by && row.id === profile.referred_by) {
        relation = "invited_you";
        relationLabel = "пригласил тебя";
      } else {
        const referral = referralEntries.find((entry) => entry.inviteeId === row.id);
        relationLabel =
          referral?.status === "activated"
            ? "ты пригласил, петля уже закрылась"
            : referral?.hasFirstClaim
              ? "ты пригласил, ждём активность"
              : "ты пригласил, ждём первый вход";
      }

      return {
        id: row.id,
        username: row.username,
        displayName: row.display_name || row.username,
        auraPoints: Number(row.aura_points || 0),
        relation,
        relationLabel,
      };
    })
    .sort((left, right) => right.auraPoints - left.auraPoints)
    .slice(0, 6);

  const activatedInvites = referralEntries.filter((entry) => entry.status === "activated").length;
  const pendingInvites = referralEntries.filter((entry) => entry.status === "pending").length;

  return {
    username: profile.username,
    displayName: profile.display_name || profile.username,
    profileShareLink,
    inviteCode: profile.invite_code || null,
    webInviteLink,
    telegramInviteLink,
    referrals: referralEntries,
    activatedInvites,
    pendingInvites,
    circleProfiles,
    moments: ((shareableMomentsResult.data as CircleTabPayload["moments"]) || []),
  };
}

async function loadHistoryPayload(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
): Promise<HistoryTabPayload> {
  const nowIso = new Date().toISOString();

  const [spotlightResult, auraLeadersResult, growthLeadersResult, transactionsResult, reengagementEventsResult] = await Promise.all([
    supabase
      .from("boosts")
      .select("profile_id, expires_at")
      .gt("expires_at", nowIso)
      .order("expires_at", { ascending: false })
      .limit(5),
    supabase.from("profiles").select("id, username, display_name, aura_points").order("aura_points", { ascending: false }).limit(5),
    supabase.rpc("get_growth_leaderboard", { p_days: 7, p_limit: 5 }),
    supabase
      .from("transactions")
      .select("id, amount, type, description, metadata, created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(20),
    supabase
      .from("notification_events")
      .select("id, event_type, status, created_at, scheduled_for, payload")
      .eq("profile_id", userId)
      .order("created_at", { ascending: false })
      .limit(6),
  ]);

  const spotlightRows = (spotlightResult.data as SpotlightRow[] | null) || [];
  const uniqueSpotlightRows = Array.from(new Map(spotlightRows.map((row) => [row.profile_id, row])).values());
  const spotlightIds = uniqueSpotlightRows.map((row) => row.profile_id);

  const spotlightProfilesResult = spotlightIds.length
    ? await supabase.from("profiles").select("id, username, display_name, aura_points").in("id", spotlightIds)
    : { data: [] as SpotlightProfileRow[] };

  const spotlightProfileMap = new Map((spotlightProfilesResult.data || []).map((row) => [row.id, row]));

  return {
    currentUserId: userId,
    events: (reengagementEventsResult.data as NotificationEventRow[] | null) || [],
    auraLeaders: (auraLeadersResult.data || []).map((row) => ({
      id: row.id,
      username: row.username,
      displayName: row.display_name || row.username,
      auraPoints: Number(row.aura_points || 0),
    })),
    growthLeaders: ((growthLeadersResult.data as GrowthLeaderRow[] | null) || []).map((row) => ({
      id: row.user_id,
      username: row.username,
      displayName: row.display_name || row.username,
      auraPoints: Number(row.aura_points || 0),
      growthPoints: Number(row.growth_points || 0),
    })),
    spotlightLeaders: uniqueSpotlightRows
      .map((row) => {
        const profileRow = spotlightProfileMap.get(row.profile_id);
        if (!profileRow) return null;

        return {
          id: profileRow.id,
          username: profileRow.username,
          displayName: profileRow.display_name || profileRow.username,
          auraPoints: Number(profileRow.aura_points || 0),
          spotlightUntil: row.expires_at,
        };
      })
      .filter((item): item is NonNullable<typeof item> => item !== null),
    transactions: (transactionsResult.data || []) as HistoryTabPayload["transactions"],
  };
}

export async function GET(request: Request) {
  const tab = normalizeProfileTab(new URL(request.url).searchParams.get("tab"));

  if (tab !== "progress" && tab !== "circle" && tab !== "history") {
    return buildApiErrorResponse(400, API_ERROR_MESSAGES.invalidRequest, {
      code: "INVALID_TAB",
      details: {
        error: "Поддерживаются только вкладки progress, circle и history.",
      },
    });
  }

  const supabase = await createClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError) {
    return buildApiErrorResponse(401, "Не удалось проверить сессию.", {
      code: "SESSION_CHECK_FAILED",
    });
  }

  if (!user) {
    return buildApiErrorResponse(401, API_ERROR_MESSAGES.unauthorized, {
      code: "UNAUTHORIZED",
    });
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("id, username, display_name, aura_points, daily_streak, last_reward_at, referred_by, invite_code")
    .eq("id", user.id)
    .single();

  if (profileError || !profile) {
    return buildApiErrorResponse(404, "Профиль не найден.", {
      code: "PROFILE_NOT_FOUND",
    });
  }

  const profileRow = profile as ProfileRow;
  if (!profileRow.invite_code) {
    const { data: inviteCode } = await supabase.rpc("ensure_profile_invite_code", { p_profile_id: user.id });
    if (inviteCode) {
      profileRow.invite_code = inviteCode;
    }
  }

  const headerStore = await headers();
  const appOriginFromEnv =
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.NEXT_PUBLIC_SITE_URL ||
    process.env.NEXT_PUBLIC_PUBLIC_APP_URL ||
    null;
  const origin = resolveOrigin(headerStore, appOriginFromEnv);
  const profileShareLink = origin ? `${origin}/check/${profileRow.username}` : `/check/${profileRow.username}`;
  const webInviteLink = profileRow.invite_code ? `${origin}/login?ref=${encodeURIComponent(profileRow.invite_code)}` : null;
  const telegramInviteLink =
    profileRow.invite_code && process.env.NEXT_PUBLIC_TELEGRAM_BOT_NAME
      ? `https://t.me/${process.env.NEXT_PUBLIC_TELEGRAM_BOT_NAME}?startapp=${encodeURIComponent(`ref_${profileRow.invite_code}`)}`
      : null;

  try {
    if (tab === "progress") {
      const payload = await loadProgressPayload(supabase, user.id, profileRow, profileShareLink, webInviteLink);
      return buildApiSuccessResponse({ tab, payload });
    }

    if (tab === "circle") {
      const payload = await loadCirclePayload(supabase, user.id, profileRow, profileShareLink, webInviteLink, telegramInviteLink);
      return buildApiSuccessResponse({ tab, payload });
    }

    const payload = await loadHistoryPayload(supabase, user.id);
    return buildApiSuccessResponse({ tab, payload });
  } catch (error) {
    console.error("[Profile Tabs API] Failed to load tab payload", {
      tab,
      userId: user.id,
      error,
    });

    return buildApiErrorResponse(500, "Не удалось загрузить данные вкладки.", {
      code: "PROFILE_TAB_LOAD_FAILED",
    });
  }
}

