import LoginClient from "./LoginClient";

interface LoginPageProps {
  searchParams: Promise<{
    error?: string;
    reason?: string;
    ref?: string;
  }>;
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const params = await searchParams;

  return <LoginClient errorCode={params.error ?? null} errorReason={params.reason ?? null} referralCode={params.ref ?? null} />;
}
