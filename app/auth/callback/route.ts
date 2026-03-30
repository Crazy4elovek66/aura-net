import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

function getOrigin(request: Request) {
  const forwardedHost = request.headers.get("x-forwarded-host");
  const forwardedProto = request.headers.get("x-forwarded-proto");
  
  if (forwardedHost && forwardedProto) {
    return `${forwardedProto}://${forwardedHost}`;
  }
  
  const { origin } = new URL(request.url);
  return origin;
}

export async function GET(request: Request) {
  const origin = getOrigin(request);
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/";

  console.log(`[Auth Callback] GET ${request.url} | Origin: ${origin} | Code: ${code ? "Yes" : "No"}`);

  const supabase = await createClient();

  // 1. Если есть код (Widget/OAuth) — обмениваем на сессию
  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) {
      console.error("[Auth Callback] Exchange Error:", error.message);
      return NextResponse.redirect(`${origin}/login?error=exchange_failed`);
    }
  }

  // 2. Проверяем наличие сессии (уже установлена для Magic Link или только что обменена)
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    console.error("[Auth Callback] No user session found after callback");
    return NextResponse.redirect(`${origin}/login?error=no_session`);
  }

  // 3. Проверка профиля (нужен ли онбординг)
  const { data: profile } = await supabase
    .from("profiles")
    .select("is_nickname_selected, username")
    .eq("id", user.id)
    .maybeSingle();

  console.log(`[Auth Callback] User: ${user.id} | Nickname Selected: ${profile?.is_nickname_selected}`);

  const needsSetup = !profile || profile.is_nickname_selected === false;
  const redirectPath = needsSetup ? "/setup-profile" : next;

  console.log(`[Auth Callback] Redirecting to: ${origin}${redirectPath}`);
  return NextResponse.redirect(`${origin}${redirectPath}`);
}
