import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.112.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Cache-Control": "no-store",
};

function json(body: unknown, status = 200) {
  return Response.json(body, { status, headers: corsHeaders });
}

function cleanReason(value: unknown) {
  return typeof value === "string" ? value.trim().slice(0, 500) : "";
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (request.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const authHeader = request.headers.get("authorization");
  if (!supabaseUrl || !serviceRoleKey || !authHeader) return json({ error: "Unauthorized" }, 401);

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const token = authHeader.replace(/^Bearer\s+/i, "");
  const { data: userData, error: userError } = await admin.auth.getUser(token);
  if (userError || !userData.user) return json({ error: "Unauthorized" }, 401);

  const { data: caller, error: callerError } = await admin
    .from("personnel_profiles")
    .select("id,rank,access_tier,status")
    .eq("auth_user_id", userData.user.id)
    .single();

  if (callerError || !caller || !["Active", "Acting"].includes(caller.status)) {
    return json({ error: "Active command profile required" }, 403);
  }

  const executiveAllowed = caller.access_tier === "Executive" && ["Sheriff", "Undersheriff"].includes(caller.rank);
  if (!executiveAllowed) return json({ error: "Only Sheriff or Undersheriff may terminate personnel." }, 403);

  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  const profileId = typeof body?.profile_id === "string" ? body.profile_id : "";
  const reason = cleanReason(body?.reason);
  if (!profileId) return json({ error: "Personnel profile is required." }, 400);
  if (reason.length < 4) return json({ error: "A termination reason is required." }, 400);
  if (profileId === caller.id) return json({ error: "You cannot terminate your own active personnel record." }, 400);

  const { data: target, error: targetError } = await admin
    .from("personnel_profiles")
    .select("id,personnel_id,display_name,rank,status,auth_user_id,call_sign")
    .eq("id", profileId)
    .single();

  if (targetError || !target) return json({ error: "Personnel profile not found." }, 404);
  if (target.status === "Deactivated") return json({ error: "This personnel record is already separated." }, 409);
  if (target.rank === "Sheriff" && caller.rank !== "Sheriff") {
    return json({ error: "The Sheriff personnel record may only be administered by the Sheriff." }, 403);
  }

  const authUserId = target.auth_user_id;
  if (authUserId) {
    await admin.from("session_events").insert({
      profile_id: profileId,
      event_type: "Session Revoked",
      user_agent: "Personnel terminated by Executive Command",
    });
  }

  const { error: deactivateError } = await admin.rpc("admin_deactivate_profile", {
    target_profile_id: profileId,
    actor_profile_id: caller.id,
  });
  if (deactivateError) return json({ error: "Personnel termination could not complete the separation workflow." }, 400);

  const effectiveAt = new Date().toISOString();
  const { error: careerError } = await admin.from("personnel_career_events").insert({
    profile_id: profileId,
    event_type: "Separation",
    effective_at: effectiveAt,
    from_rank: target.rank,
    to_rank: null,
    title: "Termination",
    notes: reason,
    recorded_by: caller.id,
  });

  await admin.from("audit_log").insert({
    actor_user_id: userData.user.id,
    actor_profile_id: caller.id,
    action: careerError ? "PERSONNEL_TERMINATED_HISTORY_SYNC_REQUIRED" : "PERSONNEL_TERMINATED",
    table_name: "personnel_profiles",
    record_id: profileId,
    new_data: {
      personnel_id: target.personnel_id,
      display_name: target.display_name,
      prior_rank: target.rank,
      released_call_sign: target.call_sign,
      reason,
      effective_at: effectiveAt,
      career_history_recorded: !careerError,
    },
  });

  if (careerError) {
    return json({ error: "Personnel was separated, but the termination history entry requires command follow-up." }, 500);
  }

  if (authUserId) {
    const { error: deleteError } = await admin.auth.admin.deleteUser(authUserId, false);
    if (deleteError) {
      return json({ error: "Personnel was terminated, but the former portal credential requires command follow-up." }, 500);
    }
  }

  return json({
    success: true,
    profile_id: profileId,
    personnel_id: target.personnel_id,
    display_name: target.display_name,
  });
});
