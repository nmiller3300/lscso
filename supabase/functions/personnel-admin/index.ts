import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.112.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Cache-Control": "no-store",
};

const rankAccess: Record<string, string> = {
  Sheriff: "Executive",
  Undersheriff: "Executive",
  Major: "Command",
  Captain: "Command",
  "1st Lieutenant": "Command",
  Lieutenant: "Supervisor",
  Sergeant: "Supervisor",
  Corporal: "Preliminary",
  "Master Deputy": "Deputy",
  "Deputy III": "Deputy",
  "Deputy II": "Deputy",
  Deputy: "Deputy",
  Recruit: "Deputy",
};

const rankRole: Record<string, string> = {
  Sheriff: "sheriff",
  Undersheriff: "undersheriff",
  Major: "command",
  Captain: "command",
  "1st Lieutenant": "command",
  Lieutenant: "supervisor",
  Sergeant: "supervisor",
  Corporal: "preliminary_supervisor",
  "Master Deputy": "deputy",
  "Deputy III": "deputy",
  "Deputy II": "deputy",
  Deputy: "deputy",
  Recruit: "deputy",
};

function json(body: unknown, status = 200) {
  return Response.json(body, { status, headers: corsHeaders });
}

function validUsername(value: unknown): value is string {
  return typeof value === "string" && /^[a-z0-9][a-z0-9._-]{2,31}$/.test(value);
}

function validPassword(value: unknown): value is string {
  return typeof value === "string" &&
    /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$/.test(value);
}

function auditReason(value: unknown) {
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

  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  const operation = body?.operation;
  const executiveAllowed = caller.access_tier === "Executive" &&
    ["Sheriff", "Undersheriff"].includes(caller.rank);
  const standingPersonnelAdmin = ["Sheriff", "Undersheriff", "Major", "Captain"].includes(caller.rank);

  let delegatedPersonnelAdmin = false;
  if (!standingPersonnelAdmin) {
    const { data: delegationRows } = await admin
      .from("personnel_delegations")
      .select("delegation_type,starts_at,expires_at,revoked_at")
      .eq("profile_id", caller.id)
      .is("revoked_at", null);

    const now = Date.now();
    delegatedPersonnelAdmin = (delegationRows ?? []).some((delegation) => {
      const started = !delegation.starts_at || new Date(delegation.starts_at).getTime() <= now;
      const unexpired = !delegation.expires_at || new Date(delegation.expires_at).getTime() > now;
      return started && unexpired && ["Personnel Administration", "Temporary Command Authority"].includes(delegation.delegation_type);
    });
  }

  const commandAllowed = standingPersonnelAdmin || delegatedPersonnelAdmin;

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

  if (operation === "change_own_password") {
    const currentPassword = typeof body?.current_password === "string" ? body.current_password : "";
    const nextPassword = body?.password;
    const verificationKey = Deno.env.get("SUPABASE_ANON_KEY") ?? serviceRoleKey;

    if (!currentPassword || !validPassword(nextPassword)) {
      return json({ error: "Use at least 8 characters with uppercase, lowercase, a number, and a symbol." }, 400);
    }
    if (currentPassword === nextPassword) {
      return json({ error: "The new password must be different from the current password." }, 400);
    }
    if (!userData.user.email) {
      return json({ error: "The secure account service is unavailable." }, 503);
    }

    const verifier = createClient(supabaseUrl, verificationKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const { error: verificationError } = await verifier.auth.signInWithPassword({
      email: userData.user.email,
      password: currentPassword,
    });
    if (verificationError) return json({ error: "The current password is incorrect." }, 400);

    const { error: passwordError } = await admin.auth.admin.updateUserById(userData.user.id, {
      password: nextPassword,
      user_metadata: {
        ...(userData.user.user_metadata ?? {}),
        must_change_password: false,
      },
    });
    if (passwordError) return json({ error: "The password could not be updated." }, 400);

    await admin.from("session_events").insert({
      profile_id: caller.id,
      event_type: "Password Changed",
      user_agent: "Self-service password change",
    });
    await writeAudit("ACCOUNT_PASSWORD_CHANGED", caller.id, { profile_id: caller.id });
    return json({ success: true });
  }

  if (!commandAllowed) return json({ error: "Personnel administration authority required" }, 403);

  if (operation === "assign_credentials") {
    const profileId = typeof body?.profile_id === "string" ? body.profile_id : "";
    const username = typeof body?.username === "string" ? body.username.trim().toLowerCase() : "";
    const password = body?.password;

    if (!profileId || !validUsername(username) || !validPassword(password)) {
      return json({ error: "A valid profile, username, and strong temporary password are required." }, 400);
    }

    const { data: target, error: targetError } = await admin
      .from("personnel_profiles")
      .select("*")
      .eq("id", profileId)
      .single();

    if (targetError || !target) return json({ error: "Personnel profile not found." }, 404);
    if (target.access_tier === "Executive" && !executiveAllowed) {
      return json({ error: "Only Sheriff or Undersheriff may assign Executive credentials." }, 403);
    }
    if (target.auth_user_id) return json({ error: "Credentials are already assigned to this profile." }, 409);

    const email = username + "@auth.lscso.internal";
    const { data: created, error: createError } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      app_metadata: {
        role: rankRole[target.rank] ?? "deputy",
        access_tier: target.access_tier,
        is_test_account: target.is_test_account,
      },
      user_metadata: {
        username,
        display_name: target.display_name,
        greeting_name: target.greeting_name,
        rank: target.rank,
        call_sign: target.call_sign,
        personnel_id: target.personnel_id,
        must_change_password: true,
      },
    });

    if (createError || !created.user) {
      return json({ error: createError?.message ?? "Credential creation failed." }, 400);
    }

    const { error: profileError } = await admin
      .from("personnel_profiles")
      .update({ auth_user_id: created.user.id, username })
      .eq("id", profileId);

    if (profileError) {
      await admin.auth.admin.deleteUser(created.user.id, false);
      return json({ error: "The personnel profile could not be linked." }, 500);
    }

    await writeAudit("ACCOUNT_CREDENTIALS_ASSIGNED", profileId, { username, target_rank: target.rank });
    return json({ success: true, profile_id: profileId, username });
  }

  if (operation === "create_personnel") {
    const username = typeof body?.username === "string" ? body.username.trim().toLowerCase() : "";
    const password = body?.password;
    const displayName = typeof body?.display_name === "string" ? body.display_name.trim() : "";
    const personnelId = typeof body?.personnel_id === "string" ? body.personnel_id.trim().toUpperCase() : "";
    const callSign = typeof body?.call_sign === "string" ? body.call_sign.trim().toUpperCase() : "";
    const rank = typeof body?.rank === "string" ? body.rank : "";
    const division = typeof body?.division === "string" ? body.division.trim() : "Unassigned";
    const isTestAccount = body?.is_test_account === true;

    if (
      !validUsername(username) || !validPassword(password) || displayName.length < 2 ||
      !/^LS-[0-9]{3}$/.test(personnelId) || !/^S-4[0-9]{2}$/.test(callSign) || !rankAccess[rank]
    ) {
      return json({ error: "Personnel and credential fields are incomplete or invalid." }, 400);
    }
    if (rankAccess[rank] === "Executive" && !executiveAllowed) {
      return json({ error: "Only Sheriff or Undersheriff may create an Executive account." }, 403);
    }

    const { data: profile, error: profileError } = await admin
      .from("personnel_profiles")
      .insert({
        personnel_id: personnelId,
        display_name: displayName,
        greeting_name: displayName,
        rank,
        access_tier: rankAccess[rank],
        call_sign: null,
        division,
        supervisor_label: "Pending command assignment",
        status: "Active",
        is_test_account: isTestAccount,
      })
      .select("*")
      .single();

    if (profileError || !profile) return json({ error: profileError?.message ?? "Profile creation failed." }, 400);

    const email = username + "@auth.lscso.internal";
    const { data: created, error: createError } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      app_metadata: {
        role: rankRole[rank],
        access_tier: rankAccess[rank],
        is_test_account: isTestAccount,
      },
      user_metadata: {
        username,
        display_name: displayName,
        greeting_name: displayName,
        rank,
        call_sign: callSign,
        personnel_id: personnelId,
        must_change_password: true,
      },
    });

    if (createError || !created.user) {
      await admin.from("personnel_profiles").delete().eq("id", profile.id);
      return json({ error: createError?.message ?? "Credential creation failed." }, 400);
    }

    const { error: linkError } = await admin
      .from("personnel_profiles")
      .update({ auth_user_id: created.user.id, username })
      .eq("id", profile.id);
    if (linkError) {
      await admin.auth.admin.deleteUser(created.user.id, false);
      await admin.from("personnel_profiles").delete().eq("id", profile.id);
      return json({ error: linkError.message }, 500);
    }

    const { error: assignmentError } = await admin.rpc("admin_assign_call_sign", {
      target_profile_id: profile.id,
      new_call_sign: callSign,
      actor_profile_id: caller.id,
      assignment_reason: "Initial command assignment",
    });
    if (assignmentError) {
      await admin.auth.admin.deleteUser(created.user.id, false);
      await admin.from("personnel_profiles").delete().eq("id", profile.id);
      return json({ error: assignmentError.message ?? "Personnel account could not be finalized." }, 500);
    }
    await writeAudit("PERSONNEL_ACCOUNT_CREATED", profile.id, { username, personnel_id: personnelId, rank });
    return json({ success: true, profile_id: profile.id, username });
  }

  const profileId = typeof body?.profile_id === "string" ? body.profile_id : "";
  if (!profileId) return json({ error: "Personnel profile is required." }, 400);

  const { data: target, error: targetError } = await admin
    .from("personnel_profiles")
    .select("*")
    .eq("id", profileId)
    .single();
  if (targetError || !target) return json({ error: "Personnel profile not found." }, 404);
  if (target.access_tier === "Executive" && !executiveAllowed) {
    return json({ error: "Only Sheriff or Undersheriff may change an Executive account." }, 403);
  }

  if (operation === "reset_password") {
    if (profileId === caller.id) {
      return json({ error: "Use My account to change your own password." }, 400);
    }
    if (!target.auth_user_id || !validPassword(body?.password)) {
      return json({ error: "An active credential and strong temporary password are required." }, 400);
    }
    const { data: authTarget } = await admin.auth.admin.getUserById(target.auth_user_id);
    const { error } = await admin.auth.admin.updateUserById(target.auth_user_id, {
      password: body.password,
      user_metadata: {
        ...(authTarget.user?.user_metadata ?? {}),
        must_change_password: true,
      },
    });
    if (error) return json({ error: "Password reset failed." }, 400);
    await admin.from("session_events").insert({
      profile_id: profileId,
      event_type: "Forced Logout",
      user_agent: "Command password reset",
    });
    await writeAudit("ACCOUNT_PASSWORD_RESET", profileId, { username: target.username });
    return json({ success: true });
  }

  if (operation === "set_status") {
    const status = body?.status;
    const reason = auditReason(body?.reason);
    if (!["Active", "Suspended"].includes(String(status))) {
      return json({ error: "Unsupported account status." }, 400);
    }
    if (reason.length < 4) return json({ error: "A command reason is required." }, 400);
    if (profileId === caller.id) return json({ error: "You cannot change your own access status." }, 400);
    if (target.status === "Deactivated") return json({ error: "A deactivated account cannot be reinstated." }, 409);

    if (target.auth_user_id) {
      const { error: authStatusError } = await admin.auth.admin.updateUserById(target.auth_user_id, {
        ban_duration: status === "Suspended" ? "876000h" : "none",
      });
      if (authStatusError) return json({ error: "Authentication status could not be changed." }, 400);
    }

    const { error } = await admin.from("personnel_profiles").update({ status }).eq("id", profileId);
    if (error) {
      if (target.auth_user_id) {
        await admin.auth.admin.updateUserById(target.auth_user_id, {
          ban_duration: target.status === "Suspended" ? "876000h" : "none",
        });
      }
      return json({ error: "Account status could not be changed." }, 400);
    }
    if (status === "Suspended") {
      await admin.from("session_events").insert({
        profile_id: profileId,
        event_type: "Forced Logout",
        user_agent: "Command suspension",
      });
    }
    await writeAudit(status === "Suspended" ? "ACCOUNT_SUSPENDED" : "ACCOUNT_REINSTATED", profileId, { status, reason });
    return json({ success: true });
  }

  if (operation === "assign_call_sign") {
    const callSign = typeof body?.call_sign === "string" ? body.call_sign.trim().toUpperCase() : "";
    const reason = auditReason(body?.reason);
    if (!/^S-4[0-9]{2}$/.test(callSign)) return json({ error: "Call sign must use S-4##." }, 400);
    if (reason.length < 4) return json({ error: "A command assignment reason is required." }, 400);

    if (target.status === "Deactivated") return json({ error: "Deactivated personnel cannot receive a call sign." }, 409);
    const { error: assignmentError } = await admin.rpc("admin_assign_call_sign", {
      target_profile_id: profileId,
      new_call_sign: callSign,
      actor_profile_id: caller.id,
      assignment_reason: reason,
    });
    if (assignmentError) return json({ error: assignmentError.message }, 409);

    if (target.auth_user_id) {
      const { data: authTarget } = await admin.auth.admin.getUserById(target.auth_user_id);
      const { error: metadataError } = await admin.auth.admin.updateUserById(target.auth_user_id, {
        user_metadata: { ...(authTarget.user?.user_metadata ?? {}), call_sign: callSign },
      });
      if (metadataError) {
        await writeAudit("AUTH_METADATA_SYNC_REQUIRED", profileId, { call_sign: callSign });
      }
    }

    await writeAudit("CALL_SIGN_ASSIGNED", profileId, { call_sign: callSign, prior: target.call_sign, reason });
    return json({ success: true });
  }

  if (operation === "deactivate") {
    const reason = auditReason(body?.reason);
    if (!executiveAllowed) return json({ error: "Only Sheriff or Undersheriff may deactivate an account." }, 403);
    if (profileId === caller.id) return json({ error: "You cannot deactivate your own active account." }, 400);
    if (reason.length < 4) return json({ error: "An Executive Command reason is required." }, 400);

    const authUserId = target.auth_user_id;
    if (authUserId) {
      await admin.from("session_events").insert({
        profile_id: profileId,
        event_type: "Session Revoked",
        user_agent: "Account deactivated by Executive Command",
      });
    }
    const { error: deactivateError } = await admin.rpc("admin_deactivate_profile", {
      target_profile_id: profileId,
      actor_profile_id: caller.id,
    });
    if (deactivateError) return json({ error: "Account deactivation failed." }, 400);

    if (authUserId) {
      const { error: deleteError } = await admin.auth.admin.deleteUser(authUserId, false);
      if (deleteError) return json({ error: "The profile was deactivated, but its credential requires command follow-up." }, 500);
    }
    await writeAudit("ACCOUNT_DEACTIVATED", profileId, { released_call_sign: target.call_sign, reason });
    return json({ success: true });
  }

  return json({ error: "Unsupported operation." }, 400);
});