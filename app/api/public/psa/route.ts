import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function serviceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  return url && key
    ? createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } })
    : null;
}

export async function GET() {
  const supabase = serviceClient();
  if (!supabase) {
    return NextResponse.json(
      { isActive: false, message: "" },
      { status: 200, headers: { "Cache-Control": "no-store, max-age=0" } },
    );
  }

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
