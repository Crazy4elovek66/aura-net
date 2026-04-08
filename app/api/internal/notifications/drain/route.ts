import { NextResponse } from "next/server";

import { drainPendingNotificationQueue } from "@/lib/server/notification-delivery";
import { createOpsEvent } from "@/lib/server/ops-events";

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
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  }

  await drainPendingNotificationQueue();
  return NextResponse.json({ success: true });
}
