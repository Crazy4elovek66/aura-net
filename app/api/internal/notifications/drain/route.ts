import { NextResponse } from "next/server";

import { createOpsEvent } from "@/lib/server/ops-events";
import { API_ERROR_MESSAGES, buildApiErrorResponse } from "@/lib/server/route-response";
import { drainRuntimeReliabilityWork } from "@/lib/server/runtime-reliability";

export async function POST(request: Request) {
  const secret = process.env.AURA_INTERNAL_CRON_SECRET;

  if (secret) {
    const provided = request.headers.get("x-aura-internal-secret");
    if (provided !== secret) {
      await createOpsEvent({
        level: "warn",
        scope: "notifications",
        eventType: "drain_forbidden",
        requestPath: new URL(request.url).pathname,
        requestId: request.headers.get("x-request-id") || request.headers.get("x-vercel-id"),
        message: "Notification drain request rejected by secret check",
      });
      return buildApiErrorResponse(403, API_ERROR_MESSAGES.forbidden, {
        code: "FORBIDDEN",
      });
    }
  }

  const reason = request.headers.get("x-aura-drain-reason") || "internal-route";
  const summary = await drainRuntimeReliabilityWork({
    source: reason,
  });
  return NextResponse.json({ success: true, summary });
}
