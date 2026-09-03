import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const supabase = await createClient() as any;
  const { data, error } = await supabase.rpc("get_system_maintenance_state");
  if (error) return NextResponse.json({ error: "Maintenance state is temporarily unavailable." }, { status: 503 });
  return NextResponse.json({ states: data ?? [], serverTime: new Date().toISOString() }, { headers: { "Cache-Control": "no-store, max-age=0" } });
}
