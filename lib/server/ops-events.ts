import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";

export type OpsEventLevel = "info" | "warn" | "error" | "critical";

export interface CreateOpsEventInput {
  level?: OpsEventLevel;
  scope: string;
  eventType: string;
  profileId?: string | null;
  actorId?: string | null;
  requestPath?: string | null;
  requestId?: string | null;
  message?: string | null;
  payload?: Record<string, unknown>;
}

function normalizePayload(payload: Record<string, unknown> | undefined) {
  if (!payload) {
    return {};
  }

  return JSON.parse(
    JSON.stringify(payload, (_key, value: unknown) => {
      if (value instanceof Error) {
        return {
          name: value.name,
          message: value.message,
          stack: value.stack,
        };
      }

      return value;
    }),
  ) as Record<string, unknown>;
}

export async function createOpsEvent(input: CreateOpsEventInput) {
  try {
    const admin = createAdminClient();
    const { error } = await admin.from("ops_events").insert({
      level: input.level ?? "info",
      scope: input.scope,
      event_type: input.eventType,
      profile_id: input.profileId ?? null,
      actor_id: input.actorId ?? null,
      request_path: input.requestPath ?? null,
      request_id: input.requestId ?? null,
      message: input.message ?? null,
      payload: normalizePayload(input.payload),
    });

    if (error) {
      console.error("[OpsEvents] Failed to write event", error.message, {
        scope: input.scope,
        eventType: input.eventType,
      });
    }
  } catch (error) {
    console.error("[OpsEvents] Failed to initialize event logging", error);
  }
}

export async function captureRouteException(params: {
  scope: string;
  eventType: string;
  request?: Request;
  profileId?: string | null;
  actorId?: string | null;
  message?: string | null;
  error: unknown;
  extra?: Record<string, unknown>;
}) {
  const requestId = params.request?.headers.get("x-request-id") || params.request?.headers.get("x-vercel-id") || null;

  await createOpsEvent({
    level: "error",
    scope: params.scope,
    eventType: params.eventType,
    profileId: params.profileId,
    actorId: params.actorId,
    requestPath: params.request ? new URL(params.request.url).pathname : null,
    requestId,
    message: params.message,
    payload: {
      error:
        params.error instanceof Error
          ? {
              name: params.error.name,
              message: params.error.message,
              stack: params.error.stack,
            }
          : String(params.error),
      ...(params.extra || {}),
    },
  });
}
