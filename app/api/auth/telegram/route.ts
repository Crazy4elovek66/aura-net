import crypto from "crypto";
import { NextResponse } from "next/server";
import { normalizeReferralCode, parseTmaUser, parseWidgetUser, type AuthPayload } from "@/lib/auth/telegram-auth";
import { createOpsEvent } from "@/lib/server/ops-events";
import { API_ERROR_MESSAGES, buildApiErrorResponse } from "@/lib/server/route-response";
import { scheduleInternalRuntimeDrain } from "@/lib/server/runtime-reliability";
import { enqueueRuntimeJob } from "@/lib/server/runtime-jobs";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { buildTelegramProfilePatch, type TelegramProfileInput } from "@/lib/auth/telegram-profile";
import { createClient } from "@supabase/supabase-js";

interface AuthResult {
  email: string;
  password: string;
  profile: TelegramProfileInput;
  referralCode: string | null;
}

function isAlreadyRegisteredError(error: { message?: string; code?: string } | null): boolean {
  if (!error) return false;
  const normalized = (error.message || "").toLowerCase();

  return (
    error.code === "email_exists" ||
    normalized.includes("already been registered") ||
    normalized.includes("already registered") ||
    normalized.includes("duplicate key value")
  );
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  return "Неизвестная ошибка";
}

function isSafeNextPath(value: string | null | undefined) {
  return Boolean(value && value.startsWith("/") && !value.startsWith("//"));
}


async function handleTelegramAuth(data: AuthPayload, botToken: string, isTma: boolean): Promise<AuthResult> {
  const userData = isTma ? parseTmaUser(data, botToken) : parseWidgetUser(data, botToken);

  const supabaseAdmin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const telegramId = userData.id;
  const username = userData.username || `user_${telegramId}`;
  const displayName = userData.first_name || username;
  const avatarUrl = userData.photo_url || null;
  const email = `${telegramId}@telegram.com`;

  const userPassword = crypto
    .createHmac("sha256", process.env.SUPABASE_SERVICE_ROLE_KEY!)
    .update(String(telegramId))
    .digest("hex");

  const { error: createError } = await supabaseAdmin.auth.admin.createUser({
    email,
    password: userPassword,
    email_confirm: true,
    user_metadata: {
      telegram_id: telegramId,
      full_name: displayName,
      avatar_url: avatarUrl,
      username,
    },
  });

  if (createError && !isAlreadyRegisteredError(createError)) {
    throw createError;
  }

  return {
    email,
    password: userPassword,
    profile: {
      firstName: userData.first_name,
      username: userData.username,
      avatarUrl,
      telegramId,
    },
    referralCode: normalizeReferralCode(userData.start_param),
  };
}

async function syncTelegramProfile(authResult: AuthResult, referralCode?: string | null) {
  const supabase = await createServerClient();
  const signInResult = await supabase.auth.signInWithPassword({
    email: authResult.email,
    password: authResult.password,
  });

  if (signInResult.error || !signInResult.data.user) {
    throw signInResult.error || new Error("Sign-in failed");
  }

  const user = signInResult.data.user;
  const { data: currentProfile } = await supabase
    .from("profiles")
    .select("is_nickname_selected, display_name, avatar_url, telegram_user, telegram_id")
    .eq("id", user.id)
    .maybeSingle();

  const patch = buildTelegramProfilePatch(currentProfile, authResult.profile);

  if (Object.keys(patch).length > 0) {
    const { error: updateError } = await supabase.from("profiles").update(patch).eq("id", user.id);
    if (updateError) {
      console.error("[Auth API] Failed to sync telegram profile", updateError.message);
      await createOpsEvent({
        level: "error",
        scope: "auth",
        eventType: "telegram_profile_sync_failed",
        profileId: user.id,
        message: updateError.message,
      });
    }
  }

  const effectiveReferralCode = normalizeReferralCode(referralCode) || authResult.referralCode;
  if (effectiveReferralCode) {
    const { error: referralError } = await supabase.rpc("bind_profile_referral", {
      p_invitee_id: user.id,
      p_invite_code: effectiveReferralCode,
      p_context: {
        source: "telegram_auth",
      },
    });

    if (referralError) {
      console.error("[Auth API] Failed to bind referral", referralError.message);
      await createOpsEvent({
        level: "warn",
        scope: "auth",
        eventType: "referral_bind_failed",
        profileId: user.id,
        message: referralError.message,
        payload: {
          referralCode: effectiveReferralCode,
        },
      });
      try {
        await enqueueRuntimeJob({
          jobType: "bind_referral",
          dedupeKey: `telegram-auth:referral-bind:${user.id}:${effectiveReferralCode}`,
          payload: {
            inviteeId: user.id,
            inviteCode: effectiveReferralCode,
            context: {
              source: "telegram_auth",
            },
          },
        });
        await scheduleInternalRuntimeDrain("telegram-auth-referral-bind");
      } catch (queueError) {
        console.error("[Auth API] Failed to queue referral bind retry", queueError);
      }
    }
  }

  const needsSetup = !currentProfile || currentProfile.is_nickname_selected === false;

  return {
    needsSetup,
  };
}

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  const nextPath = isSafeNextPath(searchParams.get("next")) ? searchParams.get("next")! : "/profile";
  const referralCode = normalizeReferralCode(searchParams.get("ref"));

  if (!botToken) {
    return NextResponse.redirect(`${origin}/login?error=config`);
  }

  try {
    const data = Object.fromEntries(searchParams.entries()) as AuthPayload;
    const authResult = await handleTelegramAuth(data, botToken, false);
    const { needsSetup } = await syncTelegramProfile(authResult, referralCode);
    const destination = needsSetup ? "/setup-profile" : nextPath;

    return NextResponse.redirect(new URL(destination, request.url));
  } catch (err: unknown) {
    const message = encodeURIComponent(getErrorMessage(err));
    console.error("[Auth API] Error (GET):", getErrorMessage(err));
    await createOpsEvent({
      level: "error",
      scope: "auth",
      eventType: "telegram_auth_get_failed",
      requestPath: new URL(request.url).pathname,
      requestId: request.headers.get("x-request-id") || request.headers.get("x-vercel-id"),
      message: getErrorMessage(err),
    });
    return NextResponse.redirect(`${origin}/login?error=telegram_widget_failed&reason=${message}`);
  }
}

export async function POST(request: Request) {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;

  if (!botToken) {
    return buildApiErrorResponse(500, API_ERROR_MESSAGES.serverConfig, {
      code: "SERVER_CONFIG",
    });
  }

  try {
    const body = (await request.json()) as AuthPayload;
    const authData = await handleTelegramAuth(body, botToken, true);
    return NextResponse.json({
      ...authData,
      referralCode: normalizeReferralCode(typeof body.ref === "string" ? body.ref : null) || authData.referralCode,
    });
  } catch (err: unknown) {
    const message = getErrorMessage(err);
    console.error("[Auth API] Error (POST):", message);
    await createOpsEvent({
      level: "error",
      scope: "auth",
      eventType: "telegram_auth_post_failed",
      requestPath: new URL(request.url).pathname,
      requestId: request.headers.get("x-request-id") || request.headers.get("x-vercel-id"),
      message,
    });
    return buildApiErrorResponse(500, message, {
      code: "TELEGRAM_AUTH_FAILED",
    });
  }
}
