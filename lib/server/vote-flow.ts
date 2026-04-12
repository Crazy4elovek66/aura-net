import {
  ANONYMOUS_VOTE_COST,
  ANONYMOUS_VOTE_DAILY_LIMIT,
  VOTE_DAILY_LIMIT,
  VOTE_PAIR_COOLDOWN_HOURS,
} from "../economy.ts";

const FORBIDDEN_ERROR_MESSAGE = "Недостаточно прав.";

export const AI_COMMENTS = {
  up: [
    "Этот вайб не купить. Плюс аура заслужен.",
    "Сильный ход. Плюс уважение в копилку.",
    "Стиль считывается сразу. Хороший плюс.",
    "Это было мощно. Аура пошла вверх.",
  ],
  down: [
    "Сегодня вайб не дотянул.",
    "Минус аура. Пора перезарядиться.",
    "Этот заход не сработал.",
    "Кринж-чек не пройден. Нужно возвращение.",
  ],
} as const;

export interface CastVoteRow {
  vote_id?: string | null;
  aura_change?: number | null;
  regular_votes_used?: number | null;
  anonymous_votes_used?: number | null;
  voter_aura_left?: number | null;
  target_aura?: number | null;
  next_available_at?: string | null;
  cooldown_hours?: number | null;
}

export interface VoteRpcErrorMapping {
  status: number;
  code: string;
  error: string;
  details?: Record<string, unknown>;
}

function extractCooldownIso(message: string): string | null {
  const match = message.match(/(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z)/i);
  return match?.[1] ?? null;
}

export function mapVoteRpcError(message: string): VoteRpcErrorMapping {
  const normalized = message.toLowerCase();

  if (normalized.includes("vote cooldown active until")) {
    const nextAvailableAt = extractCooldownIso(message);
    return {
      status: 429,
      code: "VOTE_COOLDOWN_ACTIVE",
      error: "За этот профиль можно голосовать повторно только после отката.",
      details: {
        nextAvailableAt,
        cooldownHours: VOTE_PAIR_COOLDOWN_HOURS,
      },
    };
  }

  if (
    normalized.includes("already voted") ||
    (normalized.includes("duplicate key value") && normalized.includes("votes_voter_id_target_id_key"))
  ) {
    return {
      status: 400,
      code: "ALREADY_VOTED",
      error: "Ты уже голосовал за этот профиль.",
    };
  }

  if (normalized.includes("self vote forbidden")) {
    return {
      status: 400,
      code: "SELF_VOTE_FORBIDDEN",
      error: "Голосовать за себя нельзя.",
    };
  }

  if (normalized.includes("anonymous vote daily limit reached")) {
    return {
      status: 429,
      code: "ANONYMOUS_DAILY_LIMIT_REACHED",
      error: `Лимит анонимных голосов на сегодня исчерпан (${ANONYMOUS_VOTE_DAILY_LIMIT}/${ANONYMOUS_VOTE_DAILY_LIMIT}).`,
    };
  }

  if (normalized.includes("regular vote daily limit reached")) {
    return {
      status: 429,
      code: "VOTE_DAILY_LIMIT_REACHED",
      error: `Лимит обычных голосов на сегодня исчерпан (${VOTE_DAILY_LIMIT}/${VOTE_DAILY_LIMIT}).`,
    };
  }

  if (normalized.includes("insufficient aura")) {
    return {
      status: 403,
      code: "INSUFFICIENT_AURA",
      error: `Недостаточно ауры для анонимного голоса. Нужно ${ANONYMOUS_VOTE_COST}.`,
    };
  }

  if (normalized.includes("invalid vote type")) {
    return {
      status: 400,
      code: "INVALID_VOTE_PAYLOAD",
      error: "Некорректные данные голоса.",
    };
  }

  if (normalized.includes("not allowed")) {
    return {
      status: 403,
      code: "FORBIDDEN",
      error: FORBIDDEN_ERROR_MESSAGE,
    };
  }

  if (normalized.includes("profile not found")) {
    return {
      status: 404,
      code: "PROFILE_NOT_FOUND",
      error: "Профиль не найден.",
    };
  }

  if (normalized.includes("function") && normalized.includes("does not exist")) {
    return {
      status: 501,
      code: "FUNCTION_MISSING",
      error: "Функция голосования не найдена. Примени актуальные миграции.",
    };
  }

  return {
    status: 500,
    code: "VOTE_CREATE_FAILED",
    error: "Не удалось создать голос.",
  };
}

export function buildVoteSuccessPayload(
  type: "up" | "down",
  row: CastVoteRow,
  commentPool: { up: readonly string[]; down: readonly string[] } = AI_COMMENTS,
) {
  const comments = type === "up" ? commentPool.up : commentPool.down;
  const aiComment = comments[Math.floor(Math.random() * comments.length)];

  return {
    comment: aiComment,
    newAuraChange: Number(row.aura_change || 0),
    cooldown: {
      nextAvailableAt: row.next_available_at ?? null,
      hours: Number(row.cooldown_hours || VOTE_PAIR_COOLDOWN_HOURS),
    },
    limits: {
      regularUsed: Number(row.regular_votes_used || 0),
      regularLimit: VOTE_DAILY_LIMIT,
      anonymousUsed: Number(row.anonymous_votes_used || 0),
      anonymousLimit: ANONYMOUS_VOTE_DAILY_LIMIT,
    },
  };
}

