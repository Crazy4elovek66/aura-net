import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          supabaseResponse = NextResponse.next({
            request,
          });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // REFRESH: Update session
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const pathname = request.nextUrl.pathname;
  // ACCESS CONTROL: Open access for all guests

  // ПРИНУДИТЕЛЬНЫЙ ВЫБОР НИКА (Only for authorized users)
  if (
    user && 
    !user.is_anonymous && 
    !pathname.startsWith("/setup-profile") && 
    !pathname.startsWith("/api") &&
    !pathname.startsWith("/_next") &&
    !pathname.startsWith("/admin") &&
    !pathname.startsWith("/auth")
  ) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("is_nickname_selected")
      .eq("id", user.id)
      .maybeSingle();

    if (!profile || profile.is_nickname_selected === false) {
      console.log(`[Middleware] REDIRECT: Setup Profile for user ${user.id}`);
      const url = request.nextUrl.clone();
      url.pathname = "/setup-profile";
      return NextResponse.redirect(url);
    }
  }

  return supabaseResponse;
}
