import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import crypto from "crypto";

interface TelegramUserData {
  id: number;
  first_name?: string;
  username?: string;
  photo_url?: string | null;
}

interface AuthPayload {
  initData?: string;
  hash?: string;
  id?: string | number;
  first_name?: string;
  username?: string;
  photo_url?: string;
  [key: string]: unknown;
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

  return "Unknown error";
}

function parseTmaUser(data: AuthPayload, botToken: string): TelegramUserData {
  const initData = typeof data.initData === "string" ? data.initData : "";
  if (!initData) {
    throw new Error("Missing initData");
  }

  const urlParams = new URLSearchParams(initData);
  const hash = urlParams.get("hash");
  urlParams.delete("hash");

  const dataCheckString = Array.from(urlParams.entries())
    .map(([key, value]) => `${key}=${value}`)
    .sort()
    .join("\n");

  const secretKey = crypto.createHmac("sha256", "WebAppData").update(botToken).digest();
  const calculatedHash = crypto.createHmac("sha256", secretKey).update(dataCheckString).digest("hex");

  if (!hash || calculatedHash !== hash) {
    throw new Error("Invalid TMA hash");
  }

  const userString = urlParams.get("user");
  if (!userString) {
    throw new Error("User data missing in initData");
  }

  const tgUser = JSON.parse(userString) as TelegramUserData;

  return {
    id: tgUser.id,
    first_name: tgUser.first_name,
    username: tgUser.username,
    photo_url: tgUser.photo_url || null,
  };
}

function parseWidgetUser(data: AuthPayload, botToken: string): TelegramUserData {
  const hash = typeof data.hash === "string" ? data.hash : "";
  if (!hash) {
    throw new Error("No hash provided");
  }

  const dataCheckString = Object.keys(data)
    .filter((key) => key !== "hash")
    .sort()
    .map((key) => `${key}=${String(data[key] ?? "")}`)
    .join("\n");

  const secretKey = crypto.createHash("sha256").update(botToken).digest();
  const calculatedHash = crypto.createHmac("sha256", secretKey).update(dataCheckString).digest("hex");

  if (calculatedHash !== hash) {
    throw new Error("Invalid Widget hash");
  }

  return {
    id: Number(data.id),
    first_name: typeof data.first_name === "string" ? data.first_name : "",
    username: typeof data.username === "string" ? data.username : "",
    photo_url: typeof data.photo_url === "string" ? data.photo_url : null,
  };
}

async function handleTelegramAuth(data: AuthPayload, botToken: string, isTma: boolean) {
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
  };
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const botToken = process.env.TELEGRAM_BOT_TOKEN;

  if (!botToken) {
    return NextResponse.json({ error: "Server config error" }, { status: 500 });
  }

  try {
    const data = Object.fromEntries(searchParams.entries()) as AuthPayload;
    const authData = await handleTelegramAuth(data, botToken, Boolean(data.initData));
    return NextResponse.json(authData);
  } catch (err: unknown) {
    const message = getErrorMessage(err);
    console.error("[Auth API] Error (GET):", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;

  if (!botToken) {
    return NextResponse.json({ error: "Server config error" }, { status: 500 });
  }

  try {
    const body = (await request.json()) as AuthPayload;
    const authData = await handleTelegramAuth(body, botToken, true);
    return NextResponse.json(authData);
  } catch (err: unknown) {
    const message = getErrorMessage(err);
    console.error("[Auth API] Error (POST):", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

