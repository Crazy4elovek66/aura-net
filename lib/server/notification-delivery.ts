import "server-only";

import { createOpsEvent } from "@/lib/server/ops-events";
import { createAdminClient } from "@/lib/supabase/admin";

interface NotificationQueueRow {
  id: string;
  profile_id: string;
  event_type: string;
  payload: Record<string, unknown> | null;
}

interface ProfileRow {
  id: string;
  telegram_id: number | null;
  username: string;
  display_name: string | null;
}

function asNumber(value: unknown): number | null {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function asString(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

function buildOpenLink(username?: string | null) {
  const appUrl =
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.NEXT_PUBLIC_SITE_URL ||
    process.env.NEXT_PUBLIC_PUBLIC_APP_URL ||
    "";

  if (!appUrl) return null;

  const normalized = appUrl.replace(/\/+$/, "");
  return username ? `${normalized}/check/${username}` : `${normalized}/profile`;
}

function formatEventMessage(event: NotificationQueueRow, profile: ProfileRow) {
  const payload = event.payload || {};
  const openLink = buildOpenLink(profile.username);

  if (event.event_type === "new_vote") {
    const auraChange = asNumber(payload.auraChange) ?? 0;
    const voteType = asString(payload.voteType) ?? (auraChange >= 0 ? "up" : "down");
    const voter = asString(payload.voterDisplayName) || asString(payload.voterUsername);
    const sourceText = Boolean(payload.anonymous) ? "Анонимно." : voter ? `От ${voter}.` : "";
    const actionText = voteType === "down" ? "Тебе пришёл новый минус-голос." : "Тебе пришёл новый плюс-голос.";

    return [actionText, `Изменение ауры: ${auraChange >= 0 ? `+${auraChange}` : auraChange}.`, sourceText, openLink ? `Открыть: ${openLink}` : ""]
      .filter(Boolean)
      .join("\n");
  }

  if (event.event_type === "streak_reminder") {
    const streak = asNumber(payload.streak) ?? 0;
    const availableAt = asString(payload.availableAt);
    return [
      `Серия ${streak} дн. скоро снова откроется.`,
      availableAt ? `Следующее окно daily reward: ${new Date(availableAt).toLocaleString("ru-RU")}.` : "",
      openLink ? `Открыть: ${openLink}` : "",
    ]
      .filter(Boolean)
      .join("\n");
  }

  if (event.event_type === "leaderboard_top10_entered") {
    const rank = asNumber(payload.rank);
    return [`Ты вошёл в топ-10.`, rank ? `Текущая позиция: #${rank}.` : "", openLink ? `Открыть: ${openLink}` : ""]
      .filter(Boolean)
      .join("\n");
  }

  if (event.event_type === "leaderboard_top10_dropped") {
    const rank = asNumber(payload.rank);
    return [`Ты выпал из топ-10.`, rank ? `Текущая позиция: #${rank}.` : "", openLink ? `Открыть: ${openLink}` : ""]
      .filter(Boolean)
      .join("\n");
  }

  if (event.event_type === "weekly_title_awarded") {
    const title = asString(payload.title) || "Weekly title";
    return [`Новый weekly title: ${title}.`, openLink ? `Открыть: ${openLink}` : ""].filter(Boolean).join("\n");
  }

  if (event.event_type === "tier_reached") {
    const tierLabel = asString(payload.tierLabel) || "Новый tier";
    const threshold = asNumber(payload.threshold);
    return [`Ты дошёл до тира «${tierLabel}».`, threshold ? `Порог: ${threshold} ауры.` : "", openLink ? `Открыть: ${openLink}` : ""]
      .filter(Boolean)
      .join("\n");
  }

  return [`У тебя новое событие в Aura.net.`, openLink ? `Открыть: ${openLink}` : ""].filter(Boolean).join("\n");
}

async function sendTelegramMessage(chatId: number, text: string) {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  if (!botToken) {
    return { ok: false, error: "TELEGRAM_BOT_TOKEN is not configured" };
  }

  const response = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      disable_web_page_preview: true,
    }),
  });

  const payload = (await response.json().catch(() => ({}))) as { description?: string; ok?: boolean };
  if (!response.ok || payload.ok === false) {
    return { ok: false, error: payload.description || `HTTP_${response.status}` };
  }

  return { ok: true as const };
}

export async function drainPendingNotificationQueue(limit = 8) {
  const admin = createAdminClient();
  const nowIso = new Date().toISOString();

  const { data: queuedEvents, error } = await admin
    .from("notification_events")
    .select("id, profile_id, event_type, payload")
    .eq("status", "pending")
    .lte("scheduled_for", nowIso)
    .order("scheduled_for", { ascending: true })
    .order("created_at", { ascending: true })
    .limit(limit);

  if (error) {
    console.error("[Notifications] Failed to load queue", error.message);
    await createOpsEvent({
      level: "error",
      scope: "notifications",
      eventType: "queue_load_failed",
      message: error.message,
    });
    return;
  }

  const events = (queuedEvents || []) as NotificationQueueRow[];
  if (!events.length) {
    return;
  }

  const profileIds = Array.from(new Set(events.map((event) => event.profile_id)));
  const { data: profiles, error: profileError } = await admin
    .from("profiles")
    .select("id, telegram_id, username, display_name")
    .in("id", profileIds);

  if (profileError) {
    console.error("[Notifications] Failed to load profiles", profileError.message);
    await createOpsEvent({
      level: "error",
      scope: "notifications",
      eventType: "profile_load_failed",
      message: profileError.message,
      payload: {
        profileIds,
      },
    });
    return;
  }

  const profileMap = new Map(((profiles || []) as ProfileRow[]).map((profile) => [profile.id, profile]));

  for (const event of events) {
    const { data: claimedEvent } = await admin
      .from("notification_events")
      .update({ status: "processing" })
      .eq("id", event.id)
      .eq("status", "pending")
      .select("id")
      .maybeSingle();

    if (!claimedEvent) {
      continue;
    }

    const profile = profileMap.get(event.profile_id);
    if (!profile?.telegram_id) {
      await createOpsEvent({
        level: "warn",
        scope: "notifications",
        eventType: "delivery_skipped_missing_telegram",
        profileId: event.profile_id,
        message: "Notification delivery skipped because telegram_id is missing",
        payload: {
          eventId: event.id,
          eventType: event.event_type,
        },
      });
      await admin
        .from("notification_events")
        .update({
          status: "skipped",
          error_message: "telegram_id_missing",
          processed_at: new Date().toISOString(),
        })
        .eq("id", event.id);
      continue;
    }

    const message = formatEventMessage(event, profile);
    const result = await sendTelegramMessage(profile.telegram_id, message);

    if (!result.ok) {
      await createOpsEvent({
        level: "error",
        scope: "notifications",
        eventType: "delivery_failed",
        profileId: event.profile_id,
        message: result.error,
        payload: {
          eventId: event.id,
          eventType: event.event_type,
        },
      });
    }

    await admin
      .from("notification_events")
      .update({
        status: result.ok ? "sent" : "failed",
        error_message: result.ok ? null : result.error,
        processed_at: new Date().toISOString(),
      })
      .eq("id", event.id);
  }
}
