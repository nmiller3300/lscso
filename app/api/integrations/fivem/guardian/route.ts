import { NextResponse } from "next/server";
import { authorizeFiveMIntegration } from "@/lib/integrations/fivem/auth";
import { isLscsoGrade, LSCSO_JOB_NAME } from "@/lib/integrations/fivem/ranks";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

function cleanString(value: unknown, maxLength: number) {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

function noStore(payload: unknown, status = 200) {
  return NextResponse.json(payload, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

async function verifyIdentity(request: Request, body: Record<string, unknown>) {
  const authorization = authorizeFiveMIntegration(request);
  if (!authorization.ok) {
    return { response: noStore({ ok: false, error: authorization.error }, authorization.status) };
  }

  const citizenId = cleanString(body.citizenId, 100);
  const license = cleanString(body.license, 160);
  const jobName = cleanString(body.jobName, 64).toLowerCase();
  const jobGrade = Number(body.jobGrade);

  if (!citizenId || !license) {
    return { response: noStore({ ok: false, code: "invalid_identity", error: "Citizen ID and license are required." }, 400) };
  }
  if (jobName !== LSCSO_JOB_NAME || !isLscsoGrade(jobGrade)) {
    return { response: noStore({ ok: false, code: "invalid_lscso_job", error: "Active LSCSO job access is required." }, 403) };
  }

  const admin = createAdminClient() as any;
  const { data: link, error: linkError } = await admin
    .from("fivem_identity_links")
    .select("id,personnel_profile_id,license_identifier,active")
    .eq("citizen_id", citizenId)
    .eq("active", true)
    .maybeSingle();

  if (linkError) throw linkError;
  if (!link) {
    return { response: noStore({ ok: false, code: "identity_not_linked", error: "This FiveM character is not linked to an LSCSO personnel record." }, 404) };
  }
  if (link.license_identifier && link.license_identifier !== license) {
    return { response: noStore({ ok: false, code: "identity_mismatch", error: "The linked FiveM identity does not match this character license." }, 403) };
  }

  const { data: profile, error: profileError } = await admin
    .from("personnel_profiles")
    .select("id,personnel_id,display_name,rank,call_sign,division,status,access_tier")
    .eq("id", link.personnel_profile_id)
    .maybeSingle();

  if (profileError) throw profileError;
  if (!profile || !["Active", "Acting"].includes(profile.status)) {
    return { response: noStore({ ok: false, code: "profile_inactive", error: "This LSCSO personnel record is not active." }, 403) };
  }

  const now = new Date().toISOString();
  const update: Record<string, unknown> = {
    last_seen_at: now,
    last_seen_grade: jobGrade,
    updated_at: now,
  };
  if (!link.license_identifier) update.license_identifier = license;

  const { error: updateError } = await admin
    .from("fivem_identity_links")
    .update(update)
    .eq("id", link.id);
  if (updateError) throw updateError;

  return { admin, profile };
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  if (!body) {
    return noStore({ ok: false, code: "invalid_request", error: "A JSON request body is required." }, 400);
  }

  try {
    const verified = await verifyIdentity(request, body);
    if (verified.response) return verified.response;

    const { admin, profile } = verified;
    const action = cleanString(body.action, 40).toLowerCase() || "read";

    if (action === "create") {
      const subjectProfileId = cleanString(body.subjectProfileId, 80);
      const recordType = cleanString(body.recordType, 40);
      const title = cleanString(body.title, 160);
      const observedBehavior = cleanString(body.observedBehavior, 10000);
      const incidentAt = cleanString(body.incidentAt, 80) || new Date().toISOString();
      const followUpDueAt = cleanString(body.followUpDueAt, 80) || null;
      const points = Number(body.points ?? 0);

      if (!subjectProfileId || title.length < 4 || observedBehavior.length < 10) {
        return noStore({ ok: false, code: "validation_error", error: "Choose a member and add a complete Guardian narrative." }, 400);
      }

      const { data, error } = await admin.rpc("tablet_guardian_create", {
        p_actor_profile_id: profile.id,
        p_subject_profile_id: subjectProfileId,
        p_record_type: recordType,
        p_title: title,
        p_incident_at: incidentAt,
        p_location: cleanString(body.location, 240) || null,
        p_policy_reference: cleanString(body.policyReference, 1000) || null,
        p_observed_behavior: observedBehavior,
        p_expected_standard: cleanString(body.expectedStandard, 10000) || null,
        p_action_taken: cleanString(body.actionTaken, 10000) || null,
        p_follow_up_plan: cleanString(body.followUpPlan, 4000) || null,
        p_follow_up_due_at: followUpDueAt,
        p_points: Number.isInteger(points) ? points : 0,
        p_draft: body.draft === true,
      });

      if (error) return noStore({ ok: false, code: "guardian_create_failed", error: error.message }, 409);
      return noStore({ ok: true, record: data });
    }

    if (action === "review") {
      const recordId = cleanString(body.recordId, 80);
      const decision = cleanString(body.decision, 20);
      const notes = cleanString(body.notes, 4000);
      if (!recordId || !["Approved", "Denied"].includes(decision) || notes.length < 4) {
        return noStore({ ok: false, code: "validation_error", error: "Enter a Guardian decision and review notes." }, 400);
      }

      const { data, error } = await admin.rpc("tablet_guardian_review", {
        p_actor_profile_id: profile.id,
        p_record_id: recordId,
        p_decision: decision,
        p_notes: notes,
      });
      if (error) return noStore({ ok: false, code: "guardian_review_failed", error: error.message }, 409);
      return noStore({ ok: true, record: data });
    }

    if (action === "issue") {
      const recordId = cleanString(body.recordId, 80);
      const { data, error } = await admin.rpc("tablet_guardian_issue", {
        p_actor_profile_id: profile.id,
        p_record_id: recordId,
      });
      if (error) return noStore({ ok: false, code: "guardian_issue_failed", error: error.message }, 409);
      return noStore({ ok: true, record: data });
    }

    if (action === "acknowledge") {
      const recordId = cleanString(body.recordId, 80);
      const signature = cleanString(body.signature, 160);
      const response = cleanString(body.response, 4000);
      const { data, error } = await admin.rpc("tablet_guardian_acknowledge", {
        p_actor_profile_id: profile.id,
        p_record_id: recordId,
        p_signature: signature,
        p_response: response || null,
      });
      if (error) return noStore({ ok: false, code: "guardian_acknowledge_failed", error: error.message }, 409);
      return noStore({ ok: true, record: data });
    }

    if (action !== "read") {
      return noStore({ ok: false, code: "unsupported_action", error: "Unsupported Guardian action." }, 400);
    }

    const [purviewResult, guardiansResult, rosterResult] = await Promise.all([
      admin.rpc("tablet_guardian_purview", { p_actor_profile_id: profile.id }),
      admin
        .from("guardian_records")
        .select("id,guardian_number,reference_number,subject_profile_id,author_profile_id,record_type,status,title,incident_at,location,policy_reference,observed_behavior,expected_standard,action_taken,follow_up_plan,follow_up_due_at,points_assessed,command_notes,submitted_at,approved_at,issued_at,acknowledged_at,closed_at,employee_response,created_at,updated_at")
        .order("created_at", { ascending: false })
        .limit(350),
      admin
        .from("personnel_profiles")
        .select("id,personnel_id,display_name,rank,call_sign,division,status,access_tier")
        .neq("status", "Deactivated")
        .order("display_name"),
    ]);

    if (purviewResult.error) throw purviewResult.error;
    if (guardiansResult.error) throw guardiansResult.error;
    if (rosterResult.error) throw rosterResult.error;

    const purview = purviewResult.data ?? [];
    const purviewIds = new Set(purview.map((row: any) => String(row.profile_id)));
    const commandView = ["Executive", "Command", "Attorney"].includes(profile.access_tier);
    const supervisoryStatuses = new Set(["Approved", "Issued", "Awaiting Acknowledgment", "Acknowledged", "Follow-Up Due", "Closed"]);

    const visible = (guardiansResult.data ?? []).filter((record: any) => {
      if (commandView) return true;
      if (record.author_profile_id === profile.id || record.subject_profile_id === profile.id) return true;
      return purviewIds.has(String(record.subject_profile_id)) && supervisoryStatuses.has(record.status);
    });

    const roster = rosterResult.data ?? [];
    const names = new Map(roster.map((row: any) => [String(row.id), row]));
    const guardians = visible.map((record: any) => ({
      ...record,
      subject: names.get(String(record.subject_profile_id)) ?? null,
      author: names.get(String(record.author_profile_id)) ?? null,
    }));

    return noStore({
      ok: true,
      guardian: {
        profile: {
          id: profile.id,
          personnelId: profile.personnel_id,
          displayName: profile.display_name,
          rank: profile.rank,
          callSign: profile.call_sign,
          division: profile.division,
          status: profile.status,
          accessTier: profile.access_tier,
        },
        purview,
        guardians,
        canCreate: purview.length > 0,
        canCommandReview: ["Executive", "Command"].includes(profile.access_tier),
        syncedAt: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error("[FiveM Guardian] integration failure", error);
    return noStore({ ok: false, code: "backend_error", error: "LSCSO Guardian request failed." }, 500);
  }
}
