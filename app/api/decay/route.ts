import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function POST() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data, error } = await supabase.rpc("apply_daily_decay", {
    p_profile_id: user.id,
  });

  if (error) {
    return NextResponse.json({ error: "Decay failed" }, { status: 500 });
  }

  return NextResponse.json({ success: true, lost: Number(data || 0) });
}

