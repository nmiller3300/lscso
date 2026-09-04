import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { authorizeFiveMIntegration } from "@/lib/integrations/fivem/auth";
import { getLscsoRankForGrade, isLscsoGrade, LSCSO_JOB_NAME } from "@/lib/integrations/fivem/ranks";
import { createAdminClient } from "@/lib/supabase/admin";
import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from "@/lib/supabase/config";

export const dynamic = "force-dynamic";

function cleanString(value: unknown, maxLength: number) {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

function toInternalEmail(username: string) {
  return `${username.trim().toLowerCase()}@auth.lscso.internal`;
}

function splitDisplayName(displayName: string, greetingName?: string | null) {
  const parts = displayName.trim().split(/\s+/).filter(Boolean);
  return {
    firstName: greetingName?.trim() || parts[0] || "Deputy",
    lastName: parts.length > 1 ? parts.slice(1).join(" ") : "",
  };
}

export async function POST(request: Request) {
  const authorization = authorizeFiveMIntegration(request);
  if (!authorization.ok) {
    return NextResponse.json({ ok: false, error: authorization.error }, { status: authorization.status });
  }

  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  const username = cleanString(body?.username, 80).toLowerCase();
  const password = cleanString(body?.password, 256);
  const citizenId = cleanString(body?.citizenId, 100);
  const license = cleanString(body?.license, 160);
  const jobName = cleanString(body?.jobName, 64).toLowerCase();
  const jobGrade = Number(body?.jobGrade);

  if (!username || !password || !citizenId || !license) {
    return NextResponse.json(
      { ok: false, code: "invalid_credentials_request", error: "Username, password, and FiveM identity are required." },
      { status: 400 },
    );
  }
  if (jobName !== LSCSO_JOB_NAME || !isLscsoGrade(jobGrade)) {
    return NextResponse.json(
      { ok: false, code: "invalid_lscso_job", error: "Active LSCSO employment is required." },
      { status: 403 },
    );
  }

  const auth = createSupabaseClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  const { data: authData, error: authError } = await auth.auth.signInWithPassword({
    email: toInternalEmail(username),
    password,
  });
  if (authError || !authData.user) {
    return NextResponse.json(
      { ok: false, code: "invalid_credentials", error: "The LSCSO username or password is incorrect." },
      { status: 401, headers: { "Cache-Control": "no-store" } },
    );
  }
  if (authData.user.user_metadata?.must_change_password === true) {
    return NextResponse.json(
      { ok: false, code: "account_setup_required", error: "Complete your first-time password change in the Personnel Portal before using this workstation." },
      { status: 403, headers: { "Cache-Control": "no-store" } },
    );
  }

  const admin = createAdminClient() as any;
  try {
    const { data: profile, error: profileError } = await admin
      .from("personnel_profiles")
      .select("id,personnel_id,display_name,greeting_name,rank,call_sign,division,status")
      .eq("auth_user_id", authData.user.id)
      .maybeSingle();
    if (profileError) throw profileError;
    if (!profile || !["Active", "Acting"].includes(profile.status)) {
      return NextResponse.json(
        { ok: false, code: "profile_inactive", error: "This LSCSO personnel account is not active." },
        { status: 403, headers: { "Cache-Control": "no-store" } },
      );
    }

    const { data: link, error: linkError } = await admin
      .from("fivem_identity_links")
      .select("id,citizen_id,license_identifier,active")
      .eq("personnel_profile_id", profile.id)
      .eq("active", true)
      .maybeSingle();
    if (linkError) throw linkError;
    if (!link || link.citizen_id !== citizenId) {
      return NextResponse.json(
        { ok: false, code: "character_not_linked", error: "These LSCSO credentials are not linked to this FiveM character." },
        { status: 403, headers: { "Cache-Control": "no-store" } },
      );
    }
    if (link.license_identifier && link.license_identifier !== license) {
      return NextResponse.json(
        { ok: false, code: "identity_mismatch", error: "The linked FiveM identity does not match this character license." },
        { status: 403, headers: { "Cache-Control": "no-store" } },
      );
    }

    const expectedRank = getLscsoRankForGrade(jobGrade);
    if (profile.rank !== expectedRank) {
      return NextResponse.json(
        { ok: false, code: "rank_mismatch", error: "Your active department rank does not match your personnel record. Contact Command Staff." },
        { status: 409, headers: { "Cache-Control": "no-store" } },
      );
    }

    const now = new Date().toISOString();
    const { error: updateError } = await admin
      .from("fivem_identity_links")
      .update({ license_identifier: license, last_seen_at: now, last_seen_grade: jobGrade, updated_at: now })
      .eq("id", link.id);
    if (updateError) throw updateError;

    const { firstName, lastName } = splitDisplayName(profile.display_name, profile.greeting_name);
    return NextResponse.json(
      {
        ok: true,
        user: {
          firstName,
          lastName,
          rank: profile.rank,
          badge: profile.call_sign || profile.personnel_id,
          personnelId: profile.personnel_id,
          division: profile.division,
        },
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    return NextResponse.json(
      { ok: false, code: "backend_error", error: "LSCSO workstation authentication failed." },
      { status: 500, headers: { "Cache-Control": "no-store" } },
    );
  } finally {
    await auth.auth.signOut().catch(() => undefined);
  }
}
