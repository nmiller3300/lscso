import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const supabase = await createClient() as any;
  const { data: userData } = await supabase.auth.getUser();
  let authenticatedPersonnel = false;

  if (userData?.user) {
    const { data: profile } = await supabase
      .from("personnel_profiles")
      .select("id")
      .eq("auth_user_id", userData.user.id)
      .in("status", ["Active", "Acting"])
      .maybeSingle();
    authenticatedPersonnel = Boolean(profile);
  }

  if (authenticatedPersonnel) {
    const { data, error } = await supabase.rpc("get_system_maintenance_state");
    if (error) return NextResponse.json({ error: "Maintenance state is temporarily unavailable." }, { status: 503 });
    return NextResponse.json({ states: data ?? [], serverTime: new Date().toISOString() }, { headers: { "Cache-Control": "no-store, max-age=0" } });
  }

  const { data, error } = await supabase.rpc("get_public_maintenance_state");
  if (error) return NextResponse.json({ error: "Maintenance state is temporarily unavailable." }, { status: 503 });
  return NextResponse.json({ states: data ?? [], serverTime: new Date().toISOString() }, { headers: { "Cache-Control": "no-store, max-age=0" } });
}
