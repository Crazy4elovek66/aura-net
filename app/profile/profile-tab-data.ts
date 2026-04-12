export interface ReferralEntry {
  id: string;
  inviteeId: string;
  inviteeUsername: string | null;
  inviteeDisplayName: string;
  status: "pending" | "activated" | "rejected";
  joinedAt: string;
  activatedAt: string | null;
  inviterReward: number;
  inviteeReward: number;
  hasFirstClaim: boolean;
}

export interface ProgressTabPayload {
  raceContext: {
    profileId: string;
    rank: number;
    distanceToNext: number;
    distanceToTop10: number;
    above: {
      id: string;
      username: string;
      displayName: string;
      auraPoints: number;
    } | null;
    below: {
      id: string;
      username: string;
      displayName: string;
      auraPoints: number;
    } | null;
  } | null;
  weeklyTitles: Array<{
    key: string;
    title: string;
  }>;
  trackedAt: string | null;
  currentRank: number | null;
  previousRank: number | null;
  auraDelta: number;
  newAchievements: number;
  newMoments: number;
  activatedReferrals: number;
  pendingEvents: number;
  nextSteps: {
    auraPoints: number;
    dailyStreak: number;
    claimedToday: boolean;
    activatedInvites: number;
    pendingInvites: number;
    votesCast: number;
    profileShareLink: string;
    inviteLink: string | null;
  };
}

export interface CircleProfile {
  id: string;
  username: string;
  displayName: string;
  auraPoints: number;
  relation: "you" | "invited" | "invited_you";
  relationLabel: string;
}

export interface ShareableMoment {
  id: string;
  moment_type: string;
  payload: Record<string, unknown> | null;
  created_at: string;
}

export interface CircleTabPayload {
  username: string;
  displayName: string;
  profileShareLink: string;
  inviteCode: string | null;
  webInviteLink: string | null;
  telegramInviteLink: string | null;
  referrals: ReferralEntry[];
  activatedInvites: number;
  pendingInvites: number;
  circleProfiles: CircleProfile[];
  moments: ShareableMoment[];
}

export interface HistoryTabPayload {
  currentUserId: string;
  events: Array<{
    id: string;
    event_type: string;
    status: string;
    created_at: string;
    scheduled_for: string;
    payload?: Record<string, unknown>;
  }>;
  auraLeaders: Array<{
    id: string;
    username: string;
    displayName: string;
    auraPoints: number;
  }>;
  growthLeaders: Array<{
    id: string;
    username: string;
    displayName: string;
    auraPoints: number;
    growthPoints: number;
  }>;
  spotlightLeaders: Array<{
    id: string;
    username: string;
    displayName: string;
    auraPoints: number;
    spotlightUntil: string;
  }>;
  transactions: Array<{
    id: string;
    amount: number;
    type: string;
    description: string | null;
    metadata?: Record<string, unknown> | null;
    created_at: string;
  }>;
}

