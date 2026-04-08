import "server-only";

import { drainPendingNotificationQueue, type NotificationDrainSummary } from "@/lib/server/notification-delivery";
import { createOpsEvent } from "@/lib/server/ops-events";
import { drainPendingRuntimeJobs, type RuntimeJobDrainSummary } from "@/lib/server/runtime-jobs";

const globalDrainState = globalThis as typeof globalThis & {
  __auraRuntimeDrainNextAt?: number;
  __auraRuntimeTaskCooldowns?: Map<string, number>;
};

const runtimeTaskCooldowns = globalDrainState.__auraRuntimeTaskCooldowns ?? new Map<string, number>();

if (!globalDrainState.__auraRuntimeTaskCooldowns) {
  globalDrainState.__auraRuntimeTaskCooldowns = runtimeTaskCooldowns;
}

interface DrainRuntimeReliabilityOptions {
  notificationLimit?: number;
  runtimeJobLimit?: number;
  source?: string;
}

export async function drainRuntimeReliabilityWork({
  notificationLimit = 8,
  runtimeJobLimit = 8,
  source = "local",
}: DrainRuntimeReliabilityOptions = {}): Promise<{
  notifications: NotificationDrainSummary;
  runtimeJobs: RuntimeJobDrainSummary;
}> {
  const runtimeJobs = await drainPendingRuntimeJobs(runtimeJobLimit);
  const notifications = await drainPendingNotificationQueue(notificationLimit);

  if (runtimeJobs.failed || notifications.failed) {
    await createOpsEvent({
      level: "warn",
      scope: "runtime",
      eventType: "runtime_drain_incomplete",
      message: "Runtime drain finished with retryable failures",
      payload: {
        source,
        runtimeJobs,
        notifications,
      },
    });
  }

  return {
    runtimeJobs,
    notifications,
  };
}

export async function scheduleInternalRuntimeDrain(reason: string) {
  const baseUrl =
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.NEXT_PUBLIC_SITE_URL ||
    process.env.NEXT_PUBLIC_PUBLIC_APP_URL;

  if (!baseUrl) {
    return false;
  }

  const now = Date.now();
  if ((globalDrainState.__auraRuntimeDrainNextAt || 0) > now) {
    return false;
  }

  globalDrainState.__auraRuntimeDrainNextAt = now + 5_000;
  const secret = process.env.AURA_INTERNAL_CRON_SECRET;

  try {
    await fetch(`${baseUrl.replace(/\/+$/, "")}/api/internal/notifications/drain`, {
      method: "POST",
      headers: {
        ...(secret ? { "x-aura-internal-secret": secret } : {}),
        "x-aura-drain-reason": reason,
      },
      signal: AbortSignal.timeout(8_000),
      cache: "no-store",
    });
    return true;
  } catch (error) {
    console.error("[Runtime] Failed to schedule internal drain", error);
    await createOpsEvent({
      level: "warn",
      scope: "runtime",
      eventType: "internal_drain_schedule_failed",
      message: error instanceof Error ? error.message : String(error),
      payload: {
        reason,
      },
    });
    return false;
  }
}

export function shouldRunRuntimeTask(key: string, cooldownMs: number) {
  const now = Date.now();
  const nextAllowedAt = runtimeTaskCooldowns.get(key) || 0;

  if (nextAllowedAt > now) {
    return false;
  }

  runtimeTaskCooldowns.set(key, now + Math.max(0, cooldownMs));
  return true;
}
