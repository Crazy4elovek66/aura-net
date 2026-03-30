export interface AuraUser {
  id: string;
  username: string;
  display_name: string;
  avatar_url: string | null;
  aura_points: number;
  total_votes_up: number;
  total_votes_down: number;
  status: string | null;
  is_nickname_selected: boolean;
  created_at: string;
  last_active_at: string;
}

export interface Vote {
  id: string;
  user_id: string;
  voter_ip: string;
  vote_type: "up" | "down";
  points: number;
  created_at: string;
}

export type VoteAction = "up" | "down";
