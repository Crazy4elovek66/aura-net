import LoginClient from "./LoginClient";
import { headers } from "next/headers";
import { evaluateDevLoginGateFromHeaders } from "@/lib/auth/dev-login";

interface LoginPageProps {
  searchParams: Promise<{
    error?: string;
    reason?: string;
    ref?: string;
  }>;
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const params = await searchParams;
  const headerStore = await headers();
  const devLoginEnabled = evaluateDevLoginGateFromHeaders(headerStore).enabled;

  return (
    <LoginClient
      errorCode={params.error ?? null}
      errorReason={params.reason ?? null}
      referralCode={params.ref ?? null}
      devLoginEnabled={devLoginEnabled}
    />
  );
}
