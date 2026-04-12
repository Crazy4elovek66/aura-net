import "server-only";

type HeaderLike = Pick<Headers, "get">;

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "::1"]);

function isTruthy(value: string | undefined) {
  if (!value) return false;
  return ["1", "true", "yes", "on"].includes(value.trim().toLowerCase());
}

function normalizeHostname(raw: string | null | undefined) {
  if (!raw) return null;

  const firstValue = raw.split(",")[0]?.trim();
  if (!firstValue) return null;

  try {
    return new URL(`http://${firstValue}`).hostname.toLowerCase();
  } catch {
    return null;
  }
}

function parseHostnameFromUrl(value: string | undefined) {
  if (!value) return null;

  try {
    return new URL(value).hostname.toLowerCase();
  } catch {
    try {
      return new URL(`https://${value}`).hostname.toLowerCase();
    } catch {
      return null;
    }
  }
}

function getProductionHostnames() {
  const hosts = new Set<string>();
  const candidates = [
    process.env.NEXT_PUBLIC_APP_URL,
    process.env.NEXT_PUBLIC_SITE_URL,
    process.env.NEXT_PUBLIC_PUBLIC_APP_URL,
    process.env.VERCEL_PROJECT_PRODUCTION_URL,
    ...(process.env.AURA_PRODUCTION_HOSTS || "")
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean),
  ];

  candidates.forEach((candidate) => {
    const parsedHost = parseHostnameFromUrl(candidate);
    if (parsedHost && !LOCAL_HOSTS.has(parsedHost)) {
      hosts.add(parsedHost);
    }
  });

  return hosts;
}

export interface DevLoginGateResult {
  enabled: boolean;
  reason:
    | "enabled"
    | "vercel_runtime"
    | "production_env"
    | "missing_env_switch"
    | "host_not_local"
    | "production_host"
    | "missing_credentials";
  hostname: string | null;
}

export function evaluateDevLoginGate(hostname: string | null): DevLoginGateResult {
  if (process.env.VERCEL === "1") {
    return { enabled: false, reason: "vercel_runtime", hostname };
  }

  const isProductionEnv = process.env.NODE_ENV === "production";
  if (isProductionEnv) {
    return { enabled: false, reason: "production_env", hostname };
  }

  const isDevelopmentEnv = process.env.NODE_ENV === "development";
  const enabledByFlag = isTruthy(process.env.ENABLE_DEV_LOGIN);
  if (!isDevelopmentEnv && !enabledByFlag) {
    return { enabled: false, reason: "missing_env_switch", hostname };
  }

  const productionHosts = getProductionHostnames();
  if (hostname && productionHosts.has(hostname)) {
    return { enabled: false, reason: "production_host", hostname };
  }

  if (!hostname || !LOCAL_HOSTS.has(hostname)) {
    return { enabled: false, reason: "host_not_local", hostname };
  }

  const hasCredentials = Boolean(process.env.DEV_LOGIN_EMAIL && process.env.DEV_LOGIN_PASSWORD);
  if (!hasCredentials) {
    return { enabled: false, reason: "missing_credentials", hostname };
  }

  return { enabled: true, reason: "enabled", hostname };
}

export function evaluateDevLoginGateFromHeaders(headers: HeaderLike): DevLoginGateResult {
  if (headers.get("x-vercel-id") || headers.get("x-vercel-deployment-url")) {
    return { enabled: false, reason: "vercel_runtime", hostname: null };
  }

  const forwardedHost = headers.get("x-forwarded-host");
  const host = forwardedHost || headers.get("host");
  const hostname = normalizeHostname(host);
  return evaluateDevLoginGate(hostname);
}

export function evaluateDevLoginGateFromRequest(request: Request): DevLoginGateResult {
  return evaluateDevLoginGateFromHeaders(request.headers);
}
