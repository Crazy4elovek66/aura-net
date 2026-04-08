export interface AuraUser {
  id: string;
  username: string;
  display_name: string;
  avatar_url: string | null;
  telegram_user: string | null;
  telegram_id?: number | null;
  invite_code?: string | null;
  referred_by?: string | null;
  aura_points: number;
  status: string | null;
  special_card: string | null;
  is_nickname_selected: boolean;
  last_decay_at: string;
  daily_streak: number;
  last_reward_at: string | null;
  last_streak_save_at: string | null;
  created_at: string;
}

export interface Vote {
  id: string;
  voter_id: string | null;
  target_id: string;
  vote_type: "up" | "down";
  is_anonymous: boolean;
  created_at: string;
}

export interface AuraTransaction {
  id: string;
  user_id: string;
  amount: number;
  type: string;
  description: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
}

export type VoteAction = "up" | "down";

