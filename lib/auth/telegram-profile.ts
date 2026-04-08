export interface TelegramProfileInput {
  firstName?: string;
  username?: string;
  avatarUrl?: string | null;
  telegramId?: number | null;
}

export interface ProfileSyncSource {
  is_nickname_selected?: boolean | null;
  display_name?: string | null;
  avatar_url?: string | null;
  telegram_user?: string | null;
  telegram_id?: number | null;
}

export function buildTelegramProfilePatch(currentProfile: ProfileSyncSource | null | undefined, incoming: TelegramProfileInput) {
  const patch: Record<string, string | number | null> = {};
  const normalizedTelegramUsername = incoming.username?.trim() || null;
  const normalizedAvatarUrl = incoming.avatarUrl?.trim() || null;
  const normalizedFirstName = incoming.firstName?.trim() || "";
  const normalizedTelegramId = Number.isFinite(incoming.telegramId) ? Number(incoming.telegramId) : null;
  const nicknameSelected = Boolean(currentProfile?.is_nickname_selected);

  if (normalizedTelegramUsername && normalizedTelegramUsername !== (currentProfile?.telegram_user || null)) {
    patch.telegram_user = normalizedTelegramUsername;
  }

  if (normalizedAvatarUrl && normalizedAvatarUrl !== (currentProfile?.avatar_url || null)) {
    patch.avatar_url = normalizedAvatarUrl;
  }

  if (normalizedTelegramId && normalizedTelegramId !== Number(currentProfile?.telegram_id || 0)) {
    patch.telegram_id = normalizedTelegramId;
  }

  if (!nicknameSelected && normalizedFirstName && normalizedFirstName !== (currentProfile?.display_name || null)) {
    patch.display_name = normalizedFirstName;
  }

  return patch;
}
