import "server-only";

import { createOpsEvent } from "@/lib/server/ops-events";
import { createAdminClient } from "@/lib/supabase/admin";

export type RuntimeJobType =
  | "enqueue_notification_event"
  | "sync_leaderboard_presence"
  | "refresh_weekly_titles"
  | "emit_weekly_title_moments"
  | "activate_referral"
  | "bind_referral";

interface RuntimeJobRow {
  id: string;
  job_type: RuntimeJobType;
  payload: Record<string, unknown> | null;
  attempts: number;
  max_attempts: number;
}

interface RuntimeJobExecutionResult {
  ok: boolean;
  retryable: boolean;
  error?: string;
  errorCode?: string;
}

export interface RuntimeJobDrainSummary {
  processed: number;
  completed: number;
  retried: number;
  failed: number;
  rescued: number;
}

interface EnqueueRuntimeJobInput {
  jobType: RuntimeJobType;
  payload?: Record<string, unknown> | null;
  dedupeKey?: string | null;
  scheduledFor?: string | Date | null;
  maxAttempts?: number;
}

const PROCESSING_STALE_MS = 2 * 60 * 1000;

function computeRetryDelayMs(attempt: number) {
  const boundedAttempt = Math.max(1, Math.min(attempt, 6));
  const baseDelayMs = 15_000 * 2 ** (boundedAttempt - 1);
  return Math.min(baseDelayMs, 30 * 60 * 1000);
}

function asString(value: unknown) {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

function isRetryableDbError(message: string) {
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

async function executeRuntimeJob(job: RuntimeJobRow): Promise<RuntimeJobExecutionResult> {
  const admin = createAdminClient();
  const payload = job.payload || {};

  try {
    switch (job.job_type) {
      case "enqueue_notification_event": {
        const profileId = asString(payload.profileId);
        const eventType = asString(payload.eventType);
        if (!profileId || !eventType) {
          return {
            ok: false,
            retryable: false,
            error: "profile_id_or_event_type_missing",
            errorCode: "INVALID_PAYLOAD",
          };
        }

        const { error } = await admin.rpc("enqueue_notification_event", {
          p_profile_id: profileId,
          p_event_type: eventType,
          p_payload: typeof payload.data === "object" && payload.data ? payload.data : {},
          p_dedupe_key: asString(payload.dedupeKey),
          p_channel: asString(payload.channel) || "telegram",
          p_scheduled_for: asString(payload.scheduledFor),
        });

        if (error) {
          return {
            ok: false,
            retryable: isRetryableDbError(error.message || ""),
            error: error.message || "notification_enqueue_failed",
            errorCode: error.code || "DB_ERROR",
          };
        }

        return { ok: true, retryable: false };
      }
      case "sync_leaderboard_presence": {
        const profileId = asString(payload.profileId);
        if (!profileId) {
          return { ok: false, retryable: false, error: "profile_id_missing", errorCode: "INVALID_PAYLOAD" };
        }

        const { error } = await admin.rpc("sync_leaderboard_presence_event", {
          p_profile_id: profileId,
        });

        if (error) {
          return {
            ok: false,
            retryable: isRetryableDbError(error.message || ""),
            error: error.message || "leaderboard_sync_failed",
            errorCode: error.code || "DB_ERROR",
          };
        }

        return { ok: true, retryable: false };
      }
      case "refresh_weekly_titles": {
        const { error } = await admin.rpc("refresh_weekly_titles");
        if (error) {
          return {
            ok: false,
            retryable: isRetryableDbError(error.message || ""),
            error: error.message || "weekly_titles_refresh_failed",
            errorCode: error.code || "DB_ERROR",
          };
        }

        return { ok: true, retryable: false };
      }
      case "emit_weekly_title_moments": {
        const { error } = await admin.rpc("emit_active_weekly_title_moments");
        if (error) {
          return {
            ok: false,
            retryable: isRetryableDbError(error.message || ""),
            error: error.message || "weekly_moment_emit_failed",
            errorCode: error.code || "DB_ERROR",
          };
        }

        return { ok: true, retryable: false };
      }
      case "activate_referral": {
        const inviteeId = asString(payload.inviteeId);
        if (!inviteeId) {
          return { ok: false, retryable: false, error: "invitee_id_missing", errorCode: "INVALID_PAYLOAD" };
        }

        const { error } = await admin.rpc("activate_referral_if_eligible", {
          p_invitee_id: inviteeId,
          p_source: asString(payload.source),
          p_context: typeof payload.context === "object" && payload.context ? payload.context : {},
        });

        if (error) {
          return {
            ok: false,
            retryable: isRetryableDbError(error.message || ""),
            error: error.message || "referral_activation_failed",
            errorCode: error.code || "DB_ERROR",
          };
        }

        return { ok: true, retryable: false };
      }
      case "bind_referral": {
        const inviteeId = asString(payload.inviteeId);
        const inviteCode = asString(payload.inviteCode);
        if (!inviteeId || !inviteCode) {
          return {
            ok: false,
            retryable: false,
            error: "invitee_id_or_invite_code_missing",
            errorCode: "INVALID_PAYLOAD",
          };
        }

        const { error } = await admin.rpc("bind_profile_referral", {
          p_invitee_id: inviteeId,
          p_invite_code: inviteCode,
          p_context: typeof payload.context === "object" && payload.context ? payload.context : {},
        });

        if (error) {
          return {
            ok: false,
            retryable: isRetryableDbError(error.message || ""),
            error: error.message || "referral_bind_failed",
            errorCode: error.code || "DB_ERROR",
          };
        }

        return { ok: true, retryable: false };
      }
      default:
        return { ok: false, retryable: false, error: "unsupported_job_type", errorCode: "UNSUPPORTED_JOB" };
    }
  } catch (error) {
    return {
      ok: false,
      retryable: true,
      error: error instanceof Error ? error.message : String(error),
      errorCode: "RUNTIME_ERROR",
    };
  }
}

export async function enqueueRuntimeJob({
  jobType,
  payload = {},
  dedupeKey = null,
  scheduledFor = null,
  maxAttempts = 5,
}: EnqueueRuntimeJobInput) {
  const admin = createAdminClient();
  const row = {
    job_type: jobType,
    payload,
    dedupe_key: dedupeKey,
    max_attempts: Math.max(1, maxAttempts),
    scheduled_for:
      scheduledFor instanceof Date ? scheduledFor.toISOString() : scheduledFor || new Date().toISOString(),
    status: "pending",
  };

  if (dedupeKey) {
    const { data, error } = await admin
      .from("runtime_jobs")
      .upsert(row, {
        onConflict: "dedupe_key",
        ignoreDuplicates: false,
      })
      .select("id, status, attempts")
      .maybeSingle();

    if (error) {
      throw error;
    }

    return data;
  }

  const { data, error } = await admin
    .from("runtime_jobs")
    .insert(row)
    .select("id, status, attempts")
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data;
}

export async function drainPendingRuntimeJobs(limit = 8): Promise<RuntimeJobDrainSummary> {
  const admin = createAdminClient();
  const now = new Date();
  const nowIso = now.toISOString();
  const staleIso = new Date(now.getTime() - PROCESSING_STALE_MS).toISOString();

  let rescued = 0;
  const rescueResult = await admin
    .from("runtime_jobs")
    .update({
      status: "pending",
      scheduled_for: nowIso,
      processing_started_at: null,
      updated_at: nowIso,
    })
    .eq("status", "processing")
    .lt("processing_started_at", staleIso)
    .select("id");

  if (!rescueResult.error) {
    rescued = rescueResult.data?.length || 0;
  }

  const { data, error } = await admin
    .from("runtime_jobs")
    .select("id, job_type, payload, attempts, max_attempts")
    .eq("status", "pending")
    .lte("scheduled_for", nowIso)
    .order("scheduled_for", { ascending: true })
    .order("created_at", { ascending: true })
    .limit(limit);

  if (error) {
    console.error("[RuntimeJobs] Failed to load pending jobs", error.message);
    await createOpsEvent({
      level: "error",
      scope: "runtime_jobs",
      eventType: "runtime_jobs_load_failed",
      message: error.message,
    });
    return {
      processed: 0,
      completed: 0,
      retried: 0,
      failed: 0,
      rescued,
    };
  }

  let processed = 0;
  let completed = 0;
  let retried = 0;
  let failed = 0;

  for (const job of ((data || []) as RuntimeJobRow[])) {
    const claimResult = await admin
      .from("runtime_jobs")
      .update({
        status: "processing",
        attempts: job.attempts + 1,
        processing_started_at: nowIso,
        updated_at: nowIso,
        error_message: null,
        last_error_code: null,
      })
      .eq("id", job.id)
      .eq("status", "pending")
      .select("id")
      .maybeSingle();

    if (claimResult.error || !claimResult.data) {
      continue;
    }

    processed += 1;
    const attemptNumber = job.attempts + 1;
    const result = await executeRuntimeJob(job);

    if (result.ok) {
      completed += 1;
      await admin
        .from("runtime_jobs")
        .update({
          status: "completed",
          processed_at: new Date().toISOString(),
          processing_started_at: null,
          error_message: null,
          last_error_code: null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", job.id);
      continue;
    }

    const shouldRetry = result.retryable && attemptNumber < Math.max(job.max_attempts, 1);
    const scheduledFor = shouldRetry ? new Date(Date.now() + computeRetryDelayMs(attemptNumber)).toISOString() : null;

    await createOpsEvent({
      level: shouldRetry ? "warn" : "error",
      scope: "runtime_jobs",
      eventType: shouldRetry ? "runtime_job_retry_scheduled" : "runtime_job_failed",
      message: result.error || "Runtime job failed",
      payload: {
        jobId: job.id,
        jobType: job.job_type,
        attempts: attemptNumber,
        maxAttempts: job.max_attempts,
        scheduledFor,
        errorCode: result.errorCode || null,
      },
    });

    await admin
      .from("runtime_jobs")
      .update({
        status: shouldRetry ? "pending" : "failed",
        scheduled_for: scheduledFor,
        error_message: result.error || "Runtime job failed",
        last_error_code: result.errorCode || null,
        processed_at: shouldRetry ? null : new Date().toISOString(),
        processing_started_at: null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", job.id);

    if (shouldRetry) {
      retried += 1;
    } else {
      failed += 1;
    }
  }

  return {
    processed,
    completed,
    retried,
    failed,
    rescued,
  };
}
