import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from "@/lib/supabase/config";

function publicClient() {
  return createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

export async function GET() {
  const supabase = publicClient();
  const { data, error } = await supabase
    .from("site_psa")
    .select("message,is_active,updated_at")
    .eq("id", "homepage")
    .maybeSingle();

  if (error || !data) {
    return NextResponse.json(
      { isActive: false, message: "" },
      { status: 200, headers: { "Cache-Control": "no-store, max-age=0" } },
    );
  }

  return NextResponse.json(
    {
      isActive: Boolean(data.is_active),
      message: typeof data.message === "string" ? data.message : "",
      updatedAt: data.updated_at ?? null,
    },
    { headers: { "Cache-Control": "no-store, max-age=0" } },
  );
}
