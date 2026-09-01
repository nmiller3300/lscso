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

function validPortalRedirect(value: unknown) {
  if (typeof value !== "string" || !value.trim()) {
    return "https://lscsogov.vercel.app/portal";
  }

  try {
    const url = new URL(value);
    const allowedHost = url.hostname === "lscsogov.vercel.app" ||
      url.hostname.endsWith("-nmiller3300s-projects.vercel.app");
    if (url.protocol !== "https:" || !allowedHost || !url.pathname.startsWith("/portal")) {
      return "https://lscsogov.vercel.app/portal";
    }
    return url.toString();
  } catch {
    return "https://lscsogov.vercel.app/portal";
  }
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
    .select("id,auth_user_id,rank,access_tier,status,display_name")
    .eq("auth_user_id", userData.user.id)
    .single();

  if (
    callerError || !caller ||
    caller.rank !== "Sheriff" ||
    caller.access_tier !== "Executive" ||
    !["Active", "Acting"].includes(caller.status)
  ) {
    return json({ error: "Sheriff authorization required" }, 403);
  }

  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  const operation = body?.operation;

  const writeAudit = async (action: string, recordId: string | null, newData: unknown) => {
    await admin.from("audit_log").insert({
      actor_user_id: userData.user.id,
      actor_profile_id: caller.id,
      action,
      table_name: "auth.users",
      record_id: recordId,
      new_data: newData,
    });
  };

  if (operation === "list_security_activity") {
    const [{ data: profiles, error: profileError }, { data: auditRows, error: auditError }] = await Promise.all([
      admin
        .from("personnel_profiles")
        .select("id,auth_user_id,personnel_id,display_name,username,call_sign,rank,status,last_sign_in_at")
        .order("personnel_id"),
      admin
        .from("audit_log")
        .select("record_id,action,created_at")
        .in("action", ["ACCOUNT_PASSWORD_CHANGED", "ACCOUNT_PASSWORD_RESET", "ACCOUNT_CREDENTIALS_ASSIGNED"])
        .order("created_at", { ascending: false }),
    ]);

    if (profileError || auditError) return json({ error: "Credential activity could not be loaded." }, 500);

    const latestByProfile = new Map<string, { action: string; created_at: string }>();
    for (const row of auditRows ?? []) {
      if (!row.record_id || latestByProfile.has(row.record_id)) continue;
      latestByProfile.set(row.record_id, { action: row.action, created_at: row.created_at });
    }

    return json({
      success: true,
      accounts: (profiles ?? []).map((profile) => ({
        profile_id: profile.id,
        personnel_id: profile.personnel_id,
        display_name: profile.display_name,
        username: profile.username,
        call_sign: profile.call_sign,
        rank: profile.rank,
        status: profile.status,
        credentials_assigned: Boolean(profile.auth_user_id),
        last_sign_in_at: profile.last_sign_in_at,
        last_credential_event: latestByProfile.get(profile.id)?.action ?? null,
        last_credential_at: latestByProfile.get(profile.id)?.created_at ?? null,
      })),
    });
  }

  if (operation === "generate_test_login") {
    const profileId = typeof body?.profile_id === "string" ? body.profile_id : "";
    if (!profileId) return json({ error: "Personnel profile is required." }, 400);
    if (profileId === caller.id) return json({ error: "Use your normal Sheriff session to test the Sheriff account." }, 400);

    const { data: target, error: targetError } = await admin
      .from("personnel_profiles")
      .select("id,auth_user_id,personnel_id,display_name,username,call_sign,rank,status")
      .eq("id", profileId)
      .single();

    if (targetError || !target) return json({ error: "Personnel profile not found." }, 404);
    if (!["Active", "Acting"].includes(target.status)) {
      return json({ error: "Only active personnel accounts can receive a test login." }, 409);
    }
    if (!target.auth_user_id || !target.username) {
      return json({ error: "This personnel profile does not have active login credentials." }, 409);
    }

    const { data: authTarget, error: authTargetError } = await admin.auth.admin.getUserById(target.auth_user_id);
    if (authTargetError || !authTarget.user?.email) {
      return json({ error: "The authentication account could not be resolved." }, 404);
    }

    const redirectTo = validPortalRedirect(body?.redirect_to);
    const { data: linkData, error: linkError } = await admin.auth.admin.generateLink({
      type: "magiclink",
      email: authTarget.user.email,
      options: { redirectTo },
    });

    const actionLink = linkData?.properties?.action_link;
    if (linkError || !actionLink) return json({ error: "A secure test login could not be generated." }, 500);

    await writeAudit("SHERIFF_ACCOUNT_TEST_LINK_CREATED", target.id, {
      target_profile_id: target.id,
      target_personnel_id: target.personnel_id,
      target_username: target.username,
      target_rank: target.rank,
      redirect_to: redirectTo,
    });

    return json({
      success: true,
      action_link: actionLink,
      target: {
        profile_id: target.id,
        personnel_id: target.personnel_id,
        display_name: target.display_name,
        username: target.username,
        call_sign: target.call_sign,
        rank: target.rank,
      },
    });
  }

  return json({ error: "Unsupported operation." }, 400);
});
