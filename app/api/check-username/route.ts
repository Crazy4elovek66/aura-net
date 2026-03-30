import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const username = searchParams.get("username")?.toLowerCase();

  if (!username || username.length < 3) {
    return NextResponse.json({ available: false, error: "Минимум 3 символа" });
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("profiles")
    .select("username")
    .eq("username", username)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ available: false, error: "Ошибка базы" }, { status: 500 });
  }

  return NextResponse.json({ available: !data });
}
