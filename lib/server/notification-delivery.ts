import "server-only";

import { createOpsEvent } from "@/lib/server/ops-events";
import { createAdminClient } from "@/lib/supabase/admin";

interface NotificationQueueRow {
  id: string;
  profile_id: string;
  event_type: string;
  payload: Record<string, unknown> | null;
  attempts: number;
}

interface ProfileRow {
  id: string;
  telegram_id: number | null;
  username: string;
  display_name: string | null;
}

interface TelegramDeliveryResult {
  ok: boolean;
  retryable: boolean;
  error?: string;
  errorCode?: string;
}

export interface NotificationDrainSummary {
  processed: number;
  sent: number;
  retried: number;
  failed: number;
  skipped: number;
  rescued: number;
}

const PROCESSING_STALE_MS = 2 * 60 * 1000;
const MAX_NOTIFICATION_ATTEMPTS = 6;

function asNumber(value: unknown): number | null {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function asString(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

function computeRetryDelayMs(attempt: number) {
  const boundedAttempt = Math.max(1, Math.min(attempt, 6));
  const baseDelayMs = 20_000 * 2 ** (boundedAttempt - 1);
  return Math.min(baseDelayMs, 30 * 60 * 1000);
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
    const actionText =
      voteType === "down" ? "Тебе прилетел новый минус-голос." : "Тебе прилетел новый плюс-голос.";

    return [
      actionText,
      `Изменение ауры: ${auraChange >= 0 ? `+${auraChange}` : auraChange}.`,
      sourceText,
      openLink ? `Открыть профиль: ${openLink}` : "",
    ]
      .filter(Boolean)
      .join("\n");
  }

  if (event.event_type === "streak_reminder") {
    const streak = asNumber(payload.streak) ?? 0;
    const availableAt = asString(payload.availableAt);
    return [
      `Серия держится уже ${streak} дн.`,
      availableAt ? `Следующее окно daily reward откроется ${new Date(availableAt).toLocaleString("ru-RU")}.` : "",
      openLink ? `Забрать награду: ${openLink}` : "",
    ]
      .filter(Boolean)
      .join("\n");
  }

  if (event.event_type === "leaderboard_top10_entered") {
    const rank = asNumber(payload.rank);
    return [
      "Ты ворвался в топ-10.",
      rank ? `Текущая позиция: #${rank}.` : "",
      openLink ? `Проверить рейтинг: ${openLink}` : "",
    ]
      .filter(Boolean)
      .join("\n");
  }

  if (event.event_type === "leaderboard_top10_dropped") {
    const rank = asNumber(payload.rank);
    return [
      "Ты вылетел из топ-10.",
      rank ? `Сейчас ты на позиции #${rank}.` : "",
      openLink ? `Вернуться в гонку: ${openLink}` : "",
    ]
      .filter(Boolean)
      .join("\n");
  }

  if (event.event_type === "weekly_title_awarded") {
    const title = asString(payload.title) || "Новый тайтл недели";
    return [title, openLink ? `Посмотреть профиль: ${openLink}` : ""].filter(Boolean).join("\n");
  }

  if (event.event_type === "tier_reached") {
    const tierLabel = asString(payload.tierLabel) || "Новый уровень";
    const threshold = asNumber(payload.threshold);
    return [
      `Ты поднялся до уровня «${tierLabel}».`,
      threshold ? `Порог: ${threshold} ауры.` : "",
      openLink ? `Открыть профиль: ${openLink}` : "",
    ]
      .filter(Boolean)
      .join("\n");
  }

  return ["У тебя новое событие в Aura.net.", openLink ? `Открыть: ${openLink}` : ""].filter(Boolean).join("\n");
}

async function sendTelegramMessage(chatId: number, text: string): Promise<TelegramDeliveryResult> {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  if (!botToken) {
    return {
      ok: false,
      retryable: false,
      error: "TELEGRAM_BOT_TOKEN is not configured",
      errorCode: "SERVER_CONFIG",
    };
  }

  try {
    const response = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        disable_web_page_preview: true,
      }),
      signal: AbortSignal.timeout(12_000),
    });

    const payload = (await response.json().catch(() => ({}))) as { description?: string; ok?: boolean; error_code?: number };
    if (!response.ok || payload.ok === false) {
      const errorMessage = payload.description || `HTTP_${response.status}`;
      const normalized = errorMessage.toLowerCase();
      const retryable =
        response.status >= 500 ||
        response.status === 429 ||
        normalized.includes("timed out") ||
        normalized.includes("retry after") ||
        normalized.includes("too many requests");

      return {
        ok: false,
        retryable,
        error: errorMessage,
        errorCode: String(payload.error_code || response.status),
      };
    }

    return { ok: true, retryable: false };
  } catch (error) {
    return {
      ok: false,
      retryable: true,
      error: error instanceof Error ? error.message : String(error),
      errorCode: "NETWORK_ERROR",
    };
  }
}

export async function drainPendingNotificationQueue(limit = 8): Promise<NotificationDrainSummary> {
  const admin = createAdminClient();
  const now = new Date();
  const nowIso = now.toISOString();
  const staleIso = new Date(now.getTime() - PROCESSING_STALE_MS).toISOString();

  let rescued = 0;
  const rescueResult = await admin
    .from("notification_events")
    .update({
      status: "pending",
      scheduled_for: nowIso,
      processing_started_at: null,
    })
    .eq("status", "processing")
    .lt("processing_started_at", staleIso)
    .select("id");

  if (!rescueResult.error) {
    rescued = rescueResult.data?.length || 0;
  }

  const { data: queuedEvents, error } = await admin
    .from("notification_events")
    .select("id, profile_id, event_type, payload, attempts")
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
    return {
      processed: 0,
      sent: 0,
      retried: 0,
      failed: 0,
      skipped: 0,
      rescued,
    };
  }

  const events = (queuedEvents || []) as NotificationQueueRow[];
  if (!events.length) {
    return {
      processed: 0,
      sent: 0,
      retried: 0,
      failed: 0,
      skipped: 0,
      rescued,
    };
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
    return {
      processed: 0,
      sent: 0,
      retried: 0,
      failed: 0,
      skipped: 0,
      rescued,
    };
  }

  const profileMap = new Map(((profiles || []) as ProfileRow[]).map((profile) => [profile.id, profile]));
  let processed = 0;
  let sent = 0;
  let retried = 0;
  let failed = 0;
  let skipped = 0;

  for (const event of events) {
    const claimedAt = new Date().toISOString();
    const nextAttempt = event.attempts + 1;

    const { data: claimedEvent, error: claimError } = await admin
      .from("notification_events")
      .update({
        status: "processing",
        attempts: nextAttempt,
        last_attempt_at: claimedAt,
        processing_started_at: claimedAt,
        error_message: null,
        last_error_code: null,
      })
      .eq("id", event.id)
      .eq("status", "pending")
      .select("id")
      .maybeSingle();

    if (claimError || !claimedEvent) {
      continue;
    }

    processed += 1;
    const profile = profileMap.get(event.profile_id);

    if (!profile?.telegram_id) {
      skipped += 1;
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
          last_error_code: "MISSING_TELEGRAM",
          processed_at: new Date().toISOString(),
          processing_started_at: null,
        })
        .eq("id", event.id);
      continue;
    }

    const message = formatEventMessage(event, profile);
    const result = await sendTelegramMessage(profile.telegram_id, message);

    if (result.ok) {
      sent += 1;
      await admin
        .from("notification_events")
        .update({
          status: "sent",
          error_message: null,
          last_error_code: null,
          processed_at: new Date().toISOString(),
          processing_started_at: null,
        })
        .eq("id", event.id);
      continue;
    }

    const shouldRetry = result.retryable && nextAttempt < MAX_NOTIFICATION_ATTEMPTS;
    const nextScheduledFor = shouldRetry ? new Date(Date.now() + computeRetryDelayMs(nextAttempt)).toISOString() : null;

    await createOpsEvent({
      level: shouldRetry ? "warn" : "error",
      scope: "notifications",
      eventType: shouldRetry ? "delivery_retry_scheduled" : "delivery_failed",
      profileId: event.profile_id,
      message: result.error || "Notification delivery failed",
      payload: {
        eventId: event.id,
        eventType: event.event_type,
        attempts: nextAttempt,
        retryScheduledFor: nextScheduledFor,
        errorCode: result.errorCode || null,
      },
    });

    await admin
      .from("notification_events")
      .update({
        status: shouldRetry ? "pending" : "failed",
        error_message: result.error || "Notification delivery failed",
        last_error_code: result.errorCode || null,
        scheduled_for: nextScheduledFor,
        processed_at: shouldRetry ? null : new Date().toISOString(),
        processing_started_at: null,
      })
      .eq("id", event.id);

    if (shouldRetry) {
      retried += 1;
    } else {
      failed += 1;
    }
  }

  return {
    processed,
    sent,
    retried,
    failed,
    skipped,
    rescued,
  };
}
