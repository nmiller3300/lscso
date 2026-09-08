import { NextResponse } from "next/server";
import { authorizeFiveMIntegration } from "@/lib/integrations/fivem/auth";
import { isLscsoGrade, LSCSO_JOB_NAME } from "@/lib/integrations/fivem/ranks";
import { createAdminClient } from "@/lib/supabase/admin";
import { APPLICATION_CERTIFICATION_TEXT, APPLICATION_STATUSES, INTERVIEW_STATUSES, applicationQuestions } from "@/lib/recruitment/application";

export const dynamic = "force-dynamic";

const APPLICATION_STATUS_SET = new Set(APPLICATION_STATUSES);
const INTERVIEW_STATUS_SET = new Set(INTERVIEW_STATUSES);
const FINAL_APPLICATION_STATUSES = new Set(["Accepted", "Denied", "Withdrawn"]);

function cleanString(value, maxLength = 8000) {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

function cleanId(value) {
  return cleanString(value, 100);
}

function trustedCapabilities(body) {
  const source = body && typeof body.capabilities === "object" && body.capabilities ? body.capabilities : {};
  return {
    viewApplications: source.viewApplications === true,
    manageApplications: source.manageApplications === true,
    manageApplicationForm: source.manageApplicationForm === true,
    hireWorkers: source.hireWorkers === true,
  };
}

async function resolveIdentity(admin, body) {
  const citizenId = cleanString(body.citizenId, 100);
  const license = cleanString(body.license, 160);
  const jobName = cleanString(body.jobName, 64).toLowerCase();
  const jobGrade = Number(body.jobGrade);

  if (!citizenId || !license || jobName !== LSCSO_JOB_NAME || !isLscsoGrade(jobGrade)) {
    return { ok: false, error: "Active LSCSO workstation identity is required.", code: "invalid_lscso_identity", status: 403 };
  }

  const { data: link, error: linkError } = await admin
    .from("fivem_identity_links")
    .select("id,personnel_profile_id,license_identifier,active")
    .eq("citizen_id", citizenId)
    .eq("active", true)
    .maybeSingle();
  if (linkError) throw linkError;
  if (!link) return { ok: false, error: "This character is not linked to a Personnel Portal account.", code: "identity_not_linked", status: 403 };
  if (link.license_identifier && link.license_identifier !== license) {
    return { ok: false, error: "The linked FiveM identity does not match this character license.", code: "identity_mismatch", status: 403 };
  }

  const { data: profile, error: profileError } = await admin
    .from("personnel_profiles")
    .select("id,username,display_name,greeting_name,rank,call_sign,personnel_id,status,access_tier")
    .eq("id", link.personnel_profile_id)
    .maybeSingle();
  if (profileError) throw profileError;
  if (!profile || !["Active", "Acting"].includes(profile.status)) {
    return { ok: false, error: "Your Personnel Portal account is not active.", code: "profile_unavailable", status: 403 };
  }

  await admin.from("fivem_identity_links").update({
    license_identifier: license,
    last_seen_at: new Date().toISOString(),
    last_seen_grade: jobGrade,
    updated_at: new Date().toISOString(),
  }).eq("id", link.id);

  return { ok: true, profile };
}

async function getReviewers(admin) {
  const { data, error } = await admin
    .from("personnel_profiles")
    .select("id,display_name,rank,call_sign,personnel_id,access_tier,status")
    .in("access_tier", ["Executive", "Command"])
    .in("status", ["Active", "Acting"])
    .order("display_name");
  if (error) throw error;
  return (data || []).map((person) => ({
    id: person.id,
    name: person.display_name,
    rank: person.rank,
    callSign: person.call_sign,
    personnelId: person.personnel_id,
  }));
}

async function loadDirectory(admin) {
  const [{ data: applications, error: applicationError }, reviewers, { data: settings, error: settingsError }] = await Promise.all([
    admin.from("recruitment_applications")
      .select("id,application_number,full_name,discord_username,status,submitted_at,created_at,updated_at,reviewer_profile_id,interview_status,interview_scheduled_at,decided_at")
      .order("submitted_at", { ascending: false })
      .limit(250),
    getReviewers(admin),
    admin.from("recruitment_settings")
      .select("applications_open,updated_at,updated_by_profile_id")
      .eq("id", "applications")
      .maybeSingle(),
  ]);
  if (applicationError) throw applicationError;
  if (settingsError) throw settingsError;

  const reviewerNames = new Map(reviewers.map((person) => [person.id, person.name]));
  return {
    applications: (applications || []).map((item) => ({
      id: item.id,
      applicationNumber: item.application_number,
      fullName: item.full_name,
      discordUsername: item.discord_username,
      status: item.status,
      submittedAt: item.submitted_at || item.created_at,
      updatedAt: item.updated_at,
      reviewerId: item.reviewer_profile_id,
      reviewerName: reviewerNames.get(item.reviewer_profile_id) || null,
      interviewStatus: item.interview_status,
      interviewScheduledAt: item.interview_scheduled_at,
      decidedAt: item.decided_at,
    })),
    reviewers,
    applicationsOpen: settings?.applications_open === true,
    applicationSettingsUpdatedAt: settings?.updated_at || null,
  };
}

async function loadApplication(admin, applicationId) {
  const [{ data: application, error: applicationError }, { data: notes, error: notesError }, { data: history, error: historyError }, reviewers] = await Promise.all([
    admin.from("recruitment_applications").select("*").eq("id", applicationId).maybeSingle(),
    admin.from("recruitment_application_notes").select("*").eq("application_id", applicationId).order("created_at", { ascending: false }),
    admin.from("recruitment_application_history").select("*").eq("application_id", applicationId).order("created_at", { ascending: false }),
    getReviewers(admin),
  ]);
  if (applicationError) throw applicationError;
  if (notesError) throw notesError;
  if (historyError) throw historyError;
  if (!application) return null;

  const peopleIds = new Set();
  if (application.reviewer_profile_id) peopleIds.add(application.reviewer_profile_id);
  if (application.interviewer_profile_id) peopleIds.add(application.interviewer_profile_id);
  if (application.decided_by_profile_id) peopleIds.add(application.decided_by_profile_id);
  for (const note of notes || []) if (note.author_profile_id) peopleIds.add(note.author_profile_id);
  for (const event of history || []) if (event.actor_profile_id) peopleIds.add(event.actor_profile_id);

  const names = {};
  if (peopleIds.size) {
    const { data: people, error: peopleError } = await admin
      .from("personnel_profiles")
      .select("id,display_name,rank,call_sign,personnel_id")
      .in("id", [...peopleIds]);
    if (peopleError) throw peopleError;
    for (const person of people || []) names[person.id] = person.display_name;
  }

  const answers = applicationQuestions.map(([section, key, label]) => ({
    section,
    key,
    label,
    answer: application[key] ?? "",
  }));

  return {
    application,
    answers,
    certification: {
      text: application.applicant_certification_text || APPLICATION_CERTIFICATION_TEXT,
      signed: Boolean(application.applicant_signature_name && application.applicant_signed_at),
      signedBy: application.applicant_signature_name || null,
      signedAt: application.applicant_signed_at || null,
      method: application.applicant_signature_method || null,
    },
    notes: (notes || []).map((note) => ({ ...note, authorName: names[note.author_profile_id] || "Command" })),
    history: (history || []).map((event) => ({ ...event, actorName: names[event.actor_profile_id] || "System" })),
    reviewers,
    names,
  };
}

async function getApplicationStatus(admin, applicationId) {
  const { data, error } = await admin
    .from("recruitment_applications")
    .select("id,application_number,full_name,status")
    .eq("id", applicationId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

async function writeHistory(admin, applicationId, actorProfileId, eventType, details = {}) {
  const { error } = await admin.from("recruitment_application_history").insert({
    application_id: applicationId,
    actor_profile_id: actorProfileId,
    event_type: eventType,
    details,
  });
  if (error) throw error;
}

function requireCapability(capabilities, key, message) {
  if (capabilities[key] === true) return null;
  return NextResponse.json({ ok: false, error: message, code: "permission_denied" }, { status: 403 });
}

function finalizedResponse(message) {
  return NextResponse.json({ ok: false, error: message, code: "application_finalized" }, { status: 409 });
}

export async function POST(request) {
  const auth = authorizeFiveMIntegration(request);
  if (!auth.ok) return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status });

  const admin = createAdminClient();
  if (!admin) return NextResponse.json({ ok: false, error: "Personnel service is unavailable." }, { status: 503 });

  try {
    const body = await request.json();
    if (!body || typeof body !== "object") return NextResponse.json({ ok: false, error: "Invalid application request." }, { status: 400 });

    const identity = await resolveIdentity(admin, body);
    if (!identity.ok) return NextResponse.json({ ok: false, error: identity.error, code: identity.code }, { status: identity.status });

    const capabilities = trustedCapabilities(body);
    const viewDenied = requireCapability(capabilities, "viewApplications", "You do not have permission to view recruitment applications.");
    if (viewDenied) return viewDenied;

    const action = cleanString(body.action, 40) || "read";
    const applicationId = cleanId(body.applicationId);

    if (action === "read") {
      const data = await loadDirectory(admin);
      return NextResponse.json({
        ok: true,
        account: {
          profileId: identity.profile.id,
          displayName: identity.profile.display_name,
          rank: identity.profile.rank,
          callSign: identity.profile.call_sign,
          personnelId: identity.profile.personnel_id,
        },
        capabilities,
        ...data,
      });
    }

    if (action === "read_application") {
      if (!applicationId) return NextResponse.json({ ok: false, error: "Application ID is required." }, { status: 400 });
      const detail = await loadApplication(admin, applicationId);
      if (!detail) return NextResponse.json({ ok: false, error: "Application not found." }, { status: 404 });
      return NextResponse.json({ ok: true, capabilities, ...detail });
    }

    if (action === "set_availability") {
      const denied = requireCapability(capabilities, "manageApplicationForm", "You do not have permission to change public application availability.");
      if (denied) return denied;
      if (typeof body.open !== "boolean") return NextResponse.json({ ok: false, error: "Application availability must be true or false." }, { status: 400 });
      const now = new Date().toISOString();
      const { error } = await admin.from("recruitment_settings").upsert({
        id: "applications",
        applications_open: body.open,
        updated_at: now,
        updated_by_profile_id: identity.profile.id,
      }, { onConflict: "id" });
      if (error) throw error;
      return NextResponse.json({ ok: true, applicationsOpen: body.open, updatedAt: now });
    }

    const manageDenied = requireCapability(capabilities, "manageApplications", "You do not have permission to manage recruitment applications.");
    if (manageDenied) return manageDenied;
    if (!applicationId) return NextResponse.json({ ok: false, error: "Application ID is required." }, { status: 400 });

    const current = await getApplicationStatus(admin, applicationId);
    if (!current) return NextResponse.json({ ok: false, error: "Application not found." }, { status: 404 });

    if (action === "assign_reviewer") {
      const reviewerId = cleanId(body.reviewerProfileId);
      if (!reviewerId) return NextResponse.json({ ok: false, error: "Select a reviewer." }, { status: 400 });
      const { data: reviewer, error: reviewerError } = await admin
        .from("personnel_profiles")
        .select("id,display_name,access_tier,status")
        .eq("id", reviewerId)
        .maybeSingle();
      if (reviewerError) throw reviewerError;
      if (!reviewer || !["Executive", "Command"].includes(reviewer.access_tier) || !["Active", "Acting"].includes(reviewer.status)) {
        return NextResponse.json({ ok: false, error: "The selected reviewer is unavailable." }, { status: 400 });
      }
      const { error } = await admin.from("recruitment_applications").update({ reviewer_profile_id: reviewer.id }).eq("id", applicationId);
      if (error) throw error;
      await writeHistory(admin, applicationId, identity.profile.id, "Reviewer Assigned", { reviewer_profile_id: reviewer.id, reviewer: reviewer.display_name });
      return NextResponse.json({ ok: true });
    }

    if (action === "status") {
      if (FINAL_APPLICATION_STATUSES.has(current.status)) {
        return finalizedResponse("Finalized applications cannot be moved back into active review.");
      }
      const nextStatus = cleanString(body.status, 30);
      if (!APPLICATION_STATUS_SET.has(nextStatus) || ["Accepted", "Denied"].includes(nextStatus)) {
        return NextResponse.json({ ok: false, error: "Use the final decision control for acceptance or denial." }, { status: 400 });
      }
      const { error } = await admin.from("recruitment_applications").update({ status: nextStatus }).eq("id", applicationId);
      if (error) throw error;
      await writeHistory(admin, applicationId, identity.profile.id, "Status Changed", { from: current.status, to: nextStatus });
      return NextResponse.json({ ok: true });
    }

    if (action === "decision") {
      if (FINAL_APPLICATION_STATUSES.has(current.status)) {
        return finalizedResponse("This application already has a final disposition.");
      }
      const decision = cleanString(body.status, 20);
      const reason = cleanString(body.reason);
      if (!["Accepted", "Denied"].includes(decision)) return NextResponse.json({ ok: false, error: "Invalid decision." }, { status: 400 });
      if (decision === "Denied" && reason.length < 4) return NextResponse.json({ ok: false, error: "A denial reason is required." }, { status: 400 });
      const now = new Date().toISOString();
      const { error } = await admin.from("recruitment_applications").update({
        status: decision,
        decided_at: now,
        decided_by_profile_id: identity.profile.id,
        decision_notes: reason || null,
      }).eq("id", applicationId);
      if (error) throw error;
      await writeHistory(admin, applicationId, identity.profile.id, decision, { from: current.status, reason: reason || null });
      return NextResponse.json({ ok: true });
    }

    if (action === "note") {
      const content = cleanString(body.content);
      if (!content) return NextResponse.json({ ok: false, error: "Enter a note before saving." }, { status: 400 });
      const { error } = await admin.from("recruitment_application_notes").insert({
        application_id: applicationId,
        author_profile_id: identity.profile.id,
        content,
      });
      if (error) throw error;
      await writeHistory(admin, applicationId, identity.profile.id, "Note Added", { preview: content.slice(0, 160) });
      return NextResponse.json({ ok: true });
    }

    if (action === "interview") {
      const interviewStatus = cleanString(body.interviewStatus, 30);
      const interviewerProfileId = cleanId(body.interviewerProfileId);
      const scheduledAt = cleanString(body.scheduledAt, 50);
      const notes = cleanString(body.notes);
      const result = cleanString(body.result, 1000);
      if (!INTERVIEW_STATUS_SET.has(interviewStatus)) return NextResponse.json({ ok: false, error: "Invalid interview status." }, { status: 400 });
      if (interviewerProfileId) {
        const { data: interviewer, error: interviewerError } = await admin
          .from("personnel_profiles")
          .select("id,access_tier,status")
          .eq("id", interviewerProfileId)
          .maybeSingle();
        if (interviewerError) throw interviewerError;
        if (!interviewer || !["Executive", "Command"].includes(interviewer.access_tier) || !["Active", "Acting"].includes(interviewer.status)) {
          return NextResponse.json({ ok: false, error: "The selected interviewer is unavailable." }, { status: 400 });
        }
      }
      const { error } = await admin.from("recruitment_applications").update({
        interview_status: interviewStatus,
        interviewer_profile_id: interviewerProfileId || null,
        interview_scheduled_at: scheduledAt || null,
        interview_notes: notes || null,
        interview_result: result || null,
      }).eq("id", applicationId);
      if (error) throw error;
      await writeHistory(admin, applicationId, identity.profile.id, "Interview Updated", { status: interviewStatus, scheduled_at: scheduledAt || null });
      return NextResponse.json({ ok: true });
    }

    if (action === "hire_validate") {
      const hireDenied = requireCapability(capabilities, "hireWorkers", "You do not have permission to hire employees.");
      if (hireDenied) return hireDenied;
      if (current.status !== "Accepted") return NextResponse.json({ ok: false, error: "Only accepted applicants can be hired in-game." }, { status: 409 });
      return NextResponse.json({ ok: true, application: current });
    }

    if (action === "record_hire") {
      const hireDenied = requireCapability(capabilities, "hireWorkers", "You do not have permission to hire employees.");
      if (hireDenied) return hireDenied;
      if (current.status !== "Accepted") return NextResponse.json({ ok: false, error: "Only accepted applicants can be hired in-game." }, { status: 409 });
      const targetCitizenId = cleanString(body.targetCitizenId, 100);
      const targetName = cleanString(body.targetName, 120);
      const targetServerId = Number(body.targetServerId);
      if (!targetCitizenId) return NextResponse.json({ ok: false, error: "The hired FiveM identity is missing." }, { status: 400 });
      await writeHistory(admin, applicationId, identity.profile.id, "Hired In Game", {
        application_number: current.application_number,
        target_citizen_id: targetCitizenId,
        target_name: targetName || null,
        target_server_id: Number.isFinite(targetServerId) ? targetServerId : null,
        job: LSCSO_JOB_NAME,
        grade: 0,
      });
      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ ok: false, error: "Invalid application action." }, { status: 400 });
  } catch (error) {
    console.error("[FiveM Applications]", error);
    return NextResponse.json({ ok: false, error: "The recruitment service could not complete this request." }, { status: 500 });
  }
}
