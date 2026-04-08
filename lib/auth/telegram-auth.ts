import crypto from "crypto";

export interface TelegramUserData {
  id: number;
  first_name?: string;
  username?: string;
  photo_url?: string | null;
  start_param?: string | null;
}

export interface AuthPayload {
  initData?: string;
  hash?: string;
  id?: string | number;
  first_name?: string;
  username?: string;
  photo_url?: string;
  next?: string;
  ref?: string;
  [key: string]: unknown;
}

export function isSafeNextPath(value: string | null | undefined) {
  return Boolean(value && value.startsWith("/") && !value.startsWith("//"));
}

export function normalizeReferralCode(value: string | null | undefined) {
  if (!value) return null;
  const normalized = value.trim();
  if (!normalized) return null;
  return normalized.startsWith("ref_") ? normalized.slice(4) : normalized;
}

export function parseTmaUser(data: AuthPayload, botToken: string): TelegramUserData {
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
    start_param: urlParams.get("start_param"),
  };
}

export function parseWidgetUser(data: AuthPayload, botToken: string): TelegramUserData {
  const hash = typeof data.hash === "string" ? data.hash : "";
  if (!hash) {
    throw new Error("No hash provided");
  }

  const dataCheckString = Object.keys(data)
    .filter((key) => key !== "hash" && key !== "next" && key !== "ref")
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
