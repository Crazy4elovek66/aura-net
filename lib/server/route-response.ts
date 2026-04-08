import "server-only";

import { NextResponse } from "next/server";
import type { RateLimitState } from "@/lib/server/rate-limit";

type ApiResponseExtras = Record<string, unknown>;

interface ApiErrorOptions {
  code?: string;
  headers?: HeadersInit;
  details?: ApiResponseExtras;
}

interface ApiSuccessOptions {
  status?: number;
  headers?: HeadersInit;
}

export const API_ERROR_MESSAGES = {
  unauthorized: "Нужен вход в аккаунт.",
  forbidden: "Недостаточно прав.",
  invalidJson: "Не удалось прочитать данные запроса.",
  invalidRequest: "Запрос собран некорректно.",
  serverConfig: "На сервере не хватает настройки для этого действия.",
  profileLimited: "Профиль временно ограничен.",
  profileUnavailableForVoting: "За этот профиль сейчас нельзя голосовать.",
} as const;

export function buildRateLimitHeaders(state: RateLimitState) {
  return {
    "Retry-After": String(Math.max(1, Math.ceil(state.retryAfterMs / 1000))),
    "X-RateLimit-Limit": String(state.limit),
    "X-RateLimit-Remaining": String(state.remaining),
    "X-RateLimit-Reset": new Date(state.resetAt).toISOString(),
  };
}

export function buildRateLimitResponse(message: string, state: RateLimitState) {
  return NextResponse.json(
    {
      success: false,
      error: message,
      code: "RATE_LIMITED",
    },
    {
      status: 429,
      headers: buildRateLimitHeaders(state),
    },
  );
}

export function buildApiErrorResponse(
  status: number,
  message: string,
  options: ApiErrorOptions = {},
) {
  const payload: Record<string, unknown> = {
    success: false,
    error: message,
  };

  if (options.code) {
    payload.code = options.code;
  }

  if (options.details) {
    Object.assign(payload, options.details);
  }

  return NextResponse.json(payload, {
    status,
    headers: options.headers,
  });
}

export function buildApiSuccessResponse<T extends Record<string, unknown>>(
  payload: T,
  options: ApiSuccessOptions = {},
) {
  return NextResponse.json(
    {
      success: true,
      ...payload,
    },
    {
      status: options.status,
      headers: options.headers,
    },
  );
}
