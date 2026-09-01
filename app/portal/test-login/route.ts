import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

function homeFor(accessTier: string) {
  if (accessTier === "Deputy") return "/portal/personnel";
  if (["Supervisor", "Preliminary"].includes(accessTier)) return "/portal/command/guardians";
  return "/portal/command";
}

export async function GET(request: NextRequest) {
  const tokenHash = request.nextUrl.searchParams.get("token_hash")?.trim() ?? "";
  const failureUrl = new URL("/portal", request.url);
  failureUrl.searchParams.set("test_login", "invalid");

  if (!tokenHash) return NextResponse.redirect(failureUrl);

  const supabase = await createClient() as any;
  const { data, error } = await supabase.auth.verifyOtp({
    token_hash: tokenHash,
    type: "magiclink",
  });

  if (error || !data.user) return NextResponse.redirect(failureUrl);

  const { data: profile } = await supabase
    .from("personnel_profiles")
    .select("id,access_tier,status")
    .eq("auth_user_id", data.user.id)
    .maybeSingle();

  if (!profile || !["Active", "Acting"].includes(profile.status)) {
    await supabase.auth.signOut({ scope: "local" });
    return NextResponse.redirect(failureUrl);
  }

  await supabase.rpc("record_session_event", {
    session_event_type: "Sign In",
    session_user_agent: `Sheriff account test · ${request.headers.get("user-agent") ?? "Unknown browser"}`,
  });

  const destination = new URL(homeFor(profile.access_tier), request.url);
  destination.searchParams.set("account_test", "1");
  return NextResponse.redirect(destination);
}
