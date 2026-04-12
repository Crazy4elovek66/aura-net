import { evaluateDevLoginGateFromRequest } from "@/lib/auth/dev-login";
import { createOpsEvent } from "@/lib/server/ops-events";
import {
  API_ERROR_MESSAGES,
  buildApiErrorResponse,
  buildApiSuccessResponse,
} from "@/lib/server/route-response";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

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

export async function POST(request: Request) {
  const gate = evaluateDevLoginGateFromRequest(request);
  if (!gate.enabled) {
    return buildApiErrorResponse(404, API_ERROR_MESSAGES.invalidRequest, {
      code: "DEV_LOGIN_DISABLED",
    });
  }

  const email = process.env.DEV_LOGIN_EMAIL;
  const password = process.env.DEV_LOGIN_PASSWORD;

  if (!email || !password) {
    return buildApiErrorResponse(500, API_ERROR_MESSAGES.serverConfig, {
      code: "DEV_LOGIN_MISSING_CREDENTIALS",
    });
  }

  if (!email.includes("@")) {
    return buildApiErrorResponse(400, API_ERROR_MESSAGES.invalidRequest, {
      code: "DEV_LOGIN_INVALID_EMAIL",
      details: {
        hint: "DEV_LOGIN_EMAIL must be a valid email address",
      },
    });
  }

  const admin = createAdminClient();
  const usersPerPage = 200;
  let page = 1;
  let foundUserId: string | null = null;

  while (!foundUserId) {
    const { data: pageData, error: listError } = await admin.auth.admin.listUsers({
      page,
      perPage: usersPerPage,
    });

    if (listError) {
      return buildApiErrorResponse(500, API_ERROR_MESSAGES.serverConfig, {
        code: "DEV_LOGIN_LIST_USERS_FAILED",
        details: {
          hint: listError.message,
        },
      });
    }

    const users = pageData.users || [];
    const matched = users.find((user) => (user.email || "").toLowerCase() === email.toLowerCase());
    if (matched) {
      foundUserId = matched.id;
      break;
    }

    if (users.length < usersPerPage) {
      break;
    }

    page += 1;
  }

  if (foundUserId) {
    const { error: updateError } = await admin.auth.admin.updateUserById(foundUserId, {
      password,
      email_confirm: true,
      user_metadata: {
        dev_login: true,
      },
    });

    if (updateError) {
      return buildApiErrorResponse(500, API_ERROR_MESSAGES.serverConfig, {
        code: "DEV_LOGIN_UPDATE_USER_FAILED",
        details: {
          hint: updateError.message,
        },
      });
    }
  } else {
    const { data: createdUserData, error: createError } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        dev_login: true,
      },
    });

    if (createError && !isAlreadyRegisteredError(createError)) {
      return buildApiErrorResponse(500, API_ERROR_MESSAGES.serverConfig, {
        code: "DEV_LOGIN_CREATE_USER_FAILED",
        details: {
          hint: createError.message,
        },
      });
    }

    foundUserId = createdUserData.user?.id || foundUserId;
  }

  if (!foundUserId) {
    return buildApiErrorResponse(500, API_ERROR_MESSAGES.serverConfig, {
      code: "DEV_LOGIN_USER_ID_UNRESOLVED",
    });
  }

  const fallbackUsername = `dev_${foundUserId.replace(/-/g, "").slice(0, 12)}`;
  const { data: existingProfile, error: profileReadError } = await admin
    .from("profiles")
    .select("id, is_nickname_selected")
    .eq("id", foundUserId)
    .maybeSingle();

  if (profileReadError) {
    return buildApiErrorResponse(500, API_ERROR_MESSAGES.serverConfig, {
      code: "DEV_LOGIN_PROFILE_READ_FAILED",
      details: {
        hint: profileReadError.message,
      },
    });
  }

  if (!existingProfile) {
    const { error: profileCreateError } = await admin.from("profiles").insert({
      id: foundUserId,
      username: fallbackUsername,
      display_name: "Dev Tester",
      is_nickname_selected: true,
    });

    if (profileCreateError) {
      return buildApiErrorResponse(500, API_ERROR_MESSAGES.serverConfig, {
        code: "DEV_LOGIN_PROFILE_CREATE_FAILED",
        details: {
          hint: profileCreateError.message,
        },
      });
    }
  }

  const isNicknameSelected = existingProfile?.is_nickname_selected === true;

  await createOpsEvent({
    level: "info",
    scope: "auth",
    eventType: "dev_login_succeeded",
    profileId: foundUserId,
    requestPath: new URL(request.url).pathname,
    requestId: request.headers.get("x-request-id") || request.headers.get("x-vercel-id"),
    payload: {
      hostname: gate.hostname,
    },
  });

  return buildApiSuccessResponse({
    email,
    password,
    redirectTo: isNicknameSelected ? "/profile" : "/setup-profile",
  });
}
