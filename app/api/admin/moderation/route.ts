import { consumeRateLimit, getRequestIp } from "@/lib/server/rate-limit";
import { buildRateLimitResponse } from "@/lib/server/route-response";
import { createOpsEvent } from "@/lib/server/ops-events";
import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

type ModerationAction =
  | "limit"
  | "restore"
  | "hide_discover"
  | "show_discover"
  | "hide_leaderboards"
  | "show_leaderboards";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function getPatch(action: ModerationAction) {
  switch (action) {
    case "limit":
      return { p_is_limited: true };
    case "restore":
      return { p_is_limited: false };
    case "hide_discover":
      return { p_hide_from_discover: true };
    case "show_discover":
      return { p_hide_from_discover: false };
    case "hide_leaderboards":
      return { p_hide_from_leaderboards: true };
    case "show_leaderboards":
      return { p_hide_from_leaderboards: false };
  }
}

export async function POST(request: Request) {
  const burstLimit = consumeRateLimit({
    key: `admin-moderation:ip:${getRequestIp(request)}`,
    limit: 10,
    windowMs: 10_000,
  });

  if (!burstLimit.allowed) {
    return buildRateLimitResponse("Too many admin moderation requests. Please wait a few seconds.", burstLimit);
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userLimit = consumeRateLimit({
    key: `admin-moderation:user:${user.id}`,
    limit: 8,
    windowMs: 10_000,
  });

  if (!userLimit.allowed) {
    return buildRateLimitResponse("Too many admin moderation requests. Please wait a few seconds.", userLimit);
  }

  const { data: isAdmin } = await supabase.rpc("is_platform_admin");
  if (!isAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: {
    profileId?: unknown;
    action?: unknown;
    reason?: unknown;
    note?: unknown;
  };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const profileId = typeof body.profileId === "string" ? body.profileId.trim() : "";
  const action =
    body.action === "limit" ||
    body.action === "restore" ||
    body.action === "hide_discover" ||
    body.action === "show_discover" ||
    body.action === "hide_leaderboards" ||
    body.action === "show_leaderboards"
      ? (body.action as ModerationAction)
      : null;
  const reason = typeof body.reason === "string" ? body.reason.trim() : "";
  const note = typeof body.note === "string" ? body.note.trim() : "";

  if (!profileId || !UUID_RE.test(profileId) || !action) {
    return NextResponse.json({ error: "Invalid moderation request" }, { status: 400 });
  }

  const { data, error } = await supabase.rpc("set_profile_moderation_state", {
    p_profile_id: profileId,
    p_reason: reason || null,
    p_note: note || null,
    ...getPatch(action),
  });

  if (error) {
    await createOpsEvent({
      level: "error",
      scope: "admin",
      eventType: "moderation_update_failed",
      actorId: user.id,
      profileId,
      requestPath: new URL(request.url).pathname,
      requestId: request.headers.get("x-request-id") || request.headers.get("x-vercel-id"),
      message: error.message || "Failed to update moderation state",
      payload: {
        action,
        reason,
      },
    });

    const normalized = (error.message || "").toLowerCase();
    if (normalized.includes("only platform admins")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    return NextResponse.json({ error: "Failed to update moderation state" }, { status: 500 });
  }

  await createOpsEvent({
    level: "warn",
    scope: "admin",
    eventType: "moderation_update_requested",
    actorId: user.id,
    profileId,
    requestPath: new URL(request.url).pathname,
    requestId: request.headers.get("x-request-id") || request.headers.get("x-vercel-id"),
    message: `Admin action applied: ${action}`,
    payload: {
      action,
      reason,
      rowCount: Array.isArray(data) ? data.length : null,
    },
  });

  return NextResponse.json({
    success: true,
    state: Array.isArray(data) ? data[0] || null : null,
  });
}
