import { NextResponse } from "next/server";
import { authorizeFiveMIntegration } from "@/lib/integrations/fivem/auth";
import {
  getLscsoRankForGrade,
  isLscsoGrade,
  LSCSO_JOB_NAME,
} from "@/lib/integrations/fivem/ranks";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

const OPEN_REQUEST_STATUSES = ["Submitted", "In Review"];
const CLOSED_REQUEST_STATUSES = ["Approved", "Denied", "Cancelled", "Completed"];
const LEAVE_TYPES = new Set(["Personal", "Medical", "Military", "Family", "Administrative", "Other"]);
const REQUEST_TYPES = new Set(["Promotion", "Division Transfer", "Certification", "Other"]);

function cleanString(value: unknown, maxLength: number) {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

function isDateOnly(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(new Date(`${value}T12:00:00Z`).getTime());
}

function noStoreJson(payload: unknown, status = 200) {
  return NextResponse.json(payload, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

type VerifiedIdentity = {
  admin: any;
  link: any;
  profile: any;
  citizenId: string;
  license: string;
  jobGrade: number;
};

async function verifyIdentity(request: Request, body: Record<string, unknown>): Promise<VerifiedIdentity | NextResponse> {
  const authorization = authorizeFiveMIntegration(request);
  if (!authorization.ok) {
    return noStoreJson({ ok: false, error: authorization.error }, authorization.status);
  }

  const citizenId = cleanString(body.citizenId, 100);
  const license = cleanString(body.license, 160);
  const jobName = cleanString(body.jobName, 64).toLowerCase();
  const jobGrade = Number(body.jobGrade);

  if (!citizenId || !license) {
    return noStoreJson(
      { ok: false, code: "invalid_identity", error: "Citizen ID and license are required." },
      400,
    );
  }

  if (jobName !== LSCSO_JOB_NAME || !isLscsoGrade(jobGrade)) {
    return noStoreJson(
      { ok: false, code: "invalid_lscso_job", error: "Active LSCSO job access is required." },
      403,
    );
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
    return noStoreJson(
      {
        ok: false,
        code: "identity_not_linked",
        error: "This FiveM character is not linked to an LSCSO personnel record.",
      },
      404,
    );
  }

  if (link.license_identifier && link.license_identifier !== license) {
    return noStoreJson(
      {
        ok: false,
        code: "identity_mismatch",
        error: "The linked FiveM identity does not match this character license.",
      },
      403,
    );
  }

  const { data: profile, error: profileError } = await admin
    .from("personnel_profiles")
    .select("id,personnel_id,display_name,greeting_name,rank,access_tier,call_sign,division,supervisor_label,status,is_test_account,created_at,probation_started_at,probation_ends_at")
    .eq("id", link.personnel_profile_id)
    .maybeSingle();

  if (profileError) throw profileError;
  if (!profile) {
    return noStoreJson(
      { ok: false, code: "profile_missing", error: "Linked LSCSO personnel record was not found." },
      404,
    );
  }

  if (!["Active", "Acting"].includes(profile.status)) {
    return noStoreJson(
      { ok: false, code: "profile_inactive", error: "This LSCSO personnel record is not active." },
      403,
    );
  }

  const now = new Date().toISOString();
  const linkUpdate: Record<string, unknown> = {
    last_seen_at: now,
    last_seen_grade: jobGrade,
    updated_at: now,
  };
  if (!link.license_identifier) linkUpdate.license_identifier = license;

  const { error: updateError } = await admin
    .from("fivem_identity_links")
    .update(linkUpdate)
    .eq("id", link.id);
  if (updateError) throw updateError;

  return { admin, link, profile, citizenId, license, jobGrade };
}

async function loadMyHR(identity: VerifiedIdentity) {
  const { admin, profile, jobGrade } = identity;
  const profileId = profile.id;

  const [
    certificationsResult,
    assignmentsResult,
    assignmentHistoryResult,
    guardiansResult,
    requestsResult,
    trainingResult,
    notificationsResult,
    awardsResult,
    flagsResult,
    pointEventsResult,
    tiersResult,
    correspondenceResult,
    leaveResult,
    acknowledgmentsResult,
    divisionsResult,
  ] = await Promise.all([
    admin.from("certifications").select("id,name,status,issuer,certificate_number,issued_on,expires_on,notes,created_at,updated_at").eq("profile_id", profileId).order("created_at", { ascending: false }),
    admin.from("personnel_unit_assignments").select("id,assignment_type,starts_at,ends_at,notes,organizational_units(name,unit_type)").eq("profile_id", profileId).is("ends_at", null).order("starts_at", { ascending: false }),
    admin.from("division_assignments").select("id,division,assignment_type,effective_at,ends_at,notes,created_at").eq("profile_id", profileId).order("effective_at", { ascending: false }),
    admin.from("guardian_records").select("id,guardian_number,record_type,status,title,incident_at,location,policy_reference,observed_behavior,expected_standard,action_taken,follow_up_plan,follow_up_due_at,points_assessed,employee_response,acknowledged_at,issued_at,closed_at,created_at,author:personnel_profiles!guardian_records_author_profile_id_fkey(display_name,rank)").eq("subject_profile_id", profileId).order("created_at", { ascending: false }),
    admin.from("personnel_requests").select("id,request_number,request_type,subject,details,status,requested_effective_at,requested_unit_id,current_reviewer_label,routing_stage,routing_label,decision_notes,decided_at,created_at,updated_at").eq("requester_profile_id", profileId).order("created_at", { ascending: false }),
    admin.from("training_progress").select("id,program_type,phase,status,progress_percent,started_on,completed_on,evaluation_notes,created_at,updated_at").eq("profile_id", profileId).order("created_at", { ascending: false }),
    admin.from("notifications").select("id,notification_type,title,message,href,read_at,created_at").eq("recipient_profile_id", profileId).order("created_at", { ascending: false }).limit(12),
    admin.from("personnel_awards").select("id,award_name,citation,awarded_on,image_asset_path,created_at,awarded_by").eq("profile_id", profileId).order("awarded_on", { ascending: false }),
    admin.from("personnel_flags").select("id,flag_type,notes,created_at").eq("profile_id", profileId).eq("active", true).order("created_at", { ascending: false }),
    admin.from("disciplinary_point_events").select("id,event_type,delta,reason,effective_on,guardian_id,created_at").eq("profile_id", profileId).order("effective_on", { ascending: false }).order("created_at", { ascending: false }),
    admin.from("disciplinary_point_tiers").select("id,min_points,max_points,tier_name,standing_label,action_required,color_key,sort_order").order("sort_order"),
    admin.from("personnel_correspondence").select("id,subject,body,sent_at,author:personnel_profiles!personnel_correspondence_author_profile_id_fkey(display_name,rank)").eq("recipient_profile_id", profileId).is("archived_at", null).order("sent_at", { ascending: false }),
    admin.from("leave_requests").select("id,request_number,leave_type,starts_on,expected_return_on,notes,status,review_notes,reviewed_at,created_at,updated_at").eq("profile_id", profileId).order("created_at", { ascending: false }),
    admin.from("guardian_acknowledgments").select("guardian_id,signed_at,response_text").eq("profile_id", profileId),
    admin.from("organizational_units").select("id,name,unit_type,active").eq("active", true).eq("unit_type", "Division").order("sort_order").order("name"),
  ]);

  const results = [
    certificationsResult,
    assignmentsResult,
    assignmentHistoryResult,
    guardiansResult,
    requestsResult,
    trainingResult,
    notificationsResult,
    awardsResult,
    flagsResult,
    pointEventsResult,
    tiersResult,
    correspondenceResult,
    leaveResult,
    acknowledgmentsResult,
    divisionsResult,
  ];
  const failed = results.find((result) => result.error);
  if (failed?.error) throw failed.error;

  const requests = requestsResult.data ?? [];
  const requestIds = requests.map((request: any) => request.id);
  let routeEvents: any[] = [];
  if (requestIds.length) {
    const { data, error } = await admin
      .from("personnel_request_route_events")
      .select("id,request_id,event_type,stage_label,reviewer_label,actor_label,detail,created_at")
      .in("request_id", requestIds)
      .order("created_at", { ascending: true });
    if (error) throw error;
    routeEvents = data ?? [];
  }

  const pointEvents = pointEventsResult.data ?? [];
  const pointTotal = Math.max(
    0,
    pointEvents.reduce((sum: number, event: any) => sum + Number(event.delta ?? 0), 0),
  );
  const tiers = tiersResult.data ?? [];
  const currentTier = tiers.find((tier: any) =>
    pointTotal >= Number(tier.min_points) && pointTotal <= Number(tier.max_points),
  ) ?? tiers[tiers.length - 1] ?? null;

  const acknowledgments = new Map(
    (acknowledgmentsResult.data ?? []).map((row: any) => [row.guardian_id, row]),
  );
  const guardians = (guardiansResult.data ?? []).map((record: any) => {
    const author = Array.isArray(record.author) ? record.author[0] : record.author;
    const acknowledgment = acknowledgments.get(record.id) as any;
    return {
      id: record.id,
      guardianNumber: `G-${String(record.guardian_number).padStart(4, "0")}`,
      recordType: record.record_type,
      status: record.status,
      title: record.title,
      incidentAt: record.incident_at,
      location: record.location,
      policyReference: record.policy_reference,
      observedBehavior: record.observed_behavior,
      expectedStandard: record.expected_standard,
      actionTaken: record.action_taken,
      followUpPlan: record.follow_up_plan,
      followUpDueAt: record.follow_up_due_at,
      pointsAssessed: Number(record.points_assessed ?? 0),
      employeeResponse: record.employee_response,
      issuedAt: record.issued_at,
      closedAt: record.closed_at,
      createdAt: record.created_at,
      author: author ? { displayName: author.display_name, rank: author.rank } : null,
      acknowledgment: record.acknowledged_at || acknowledgment
        ? {
            signedAt: acknowledgment?.signed_at ?? record.acknowledged_at,
            responseText: acknowledgment?.response_text ?? record.employee_response,
          }
        : null,
    };
  });

  const routesByRequest = new Map<string, any[]>();
  for (const event of routeEvents) {
    const list = routesByRequest.get(event.request_id) ?? [];
    list.push({
      id: event.id,
      eventType: event.event_type,
      stageLabel: event.stage_label,
      reviewerLabel: event.reviewer_label,
      actorLabel: event.actor_label,
      detail: event.detail,
      createdAt: event.created_at,
    });
    routesByRequest.set(event.request_id, list);
  }

  const divisionNames = new Map(
    (divisionsResult.data ?? []).map((unit: any) => [String(unit.id), String(unit.name)]),
  );
  const personnelRequests = requests.map((request: any) => ({
    id: request.id,
    requestNumber: `RQ-${String(request.request_number).padStart(4, "0")}`,
    requestType: request.request_type,
    subject: request.subject,
    details: request.details,
    status: request.status,
    requestedEffectiveAt: request.requested_effective_at,
    requestedUnitId: request.requested_unit_id,
    requestedUnitName: request.requested_unit_id ? divisionNames.get(String(request.requested_unit_id)) ?? null : null,
    currentReviewerLabel: request.current_reviewer_label,
    routingStage: request.routing_stage,
    routingLabel: request.routing_label,
    decisionNotes: request.decision_notes,
    decidedAt: request.decided_at,
    createdAt: request.created_at,
    updatedAt: request.updated_at,
    routeEvents: routesByRequest.get(request.id) ?? [],
  }));

  const certifications = certificationsResult.data ?? [];
  const now = new Date();
  const expiringSoon = certifications.filter((certification: any) => {
    if (certification.status !== "Current" || !certification.expires_on) return false;
    const expires = new Date(`${certification.expires_on}T23:59:59`);
    const days = (expires.getTime() - now.getTime()) / 86_400_000;
    return days >= 0 && days <= 30;
  });
  const expired = certifications.filter((certification: any) => {
    if (!certification.expires_on) return certification.status === "Expired";
    return new Date(`${certification.expires_on}T23:59:59`).getTime() < now.getTime();
  });

  const leaveRequests = leaveResult.data ?? [];
  const today = now.toISOString().slice(0, 10);
  const activeLeave = leaveRequests.find((leave: any) =>
    leave.status === "Approved" && leave.starts_on <= today && leave.expected_return_on >= today,
  ) ?? null;

  const pendingAcknowledgments = guardians.filter((record: any) =>
    !record.acknowledgment && !["Draft", "Pending Approval", "Denied", "Closed"].includes(record.status),
  );
  const openRequests = personnelRequests.filter((request: any) =>
    !CLOSED_REQUEST_STATUSES.includes(request.status),
  );
  const openLeaveRequests = leaveRequests.filter((request: any) =>
    !CLOSED_REQUEST_STATUSES.includes(request.status),
  );

  const attention: Array<{ type: string; severity: string; title: string; detail: string }> = [];
  for (const guardian of pendingAcknowledgments.slice(0, 3)) {
    attention.push({
      type: "guardian",
      severity: "action",
      title: `${guardian.guardianNumber} requires acknowledgment`,
      detail: guardian.title || guardian.recordType,
    });
  }
  for (const certification of expiringSoon.slice(0, 3)) {
    attention.push({
      type: "certification",
      severity: "warning",
      title: `${certification.name} expires soon`,
      detail: `Expires ${certification.expires_on}`,
    });
  }
  if (activeLeave) {
    attention.push({
      type: "leave",
      severity: "info",
      title: "Leave of Absence active",
      detail: `Expected return ${activeLeave.expected_return_on}`,
    });
  }

  const assignments = (assignmentsResult.data ?? []).map((assignment: any) => {
    const unit = Array.isArray(assignment.organizational_units)
      ? assignment.organizational_units[0]
      : assignment.organizational_units;
    return {
      id: assignment.id,
      assignmentType: assignment.assignment_type,
      startsAt: assignment.starts_at,
      endsAt: assignment.ends_at,
      notes: assignment.notes,
      unitName: unit?.name ?? null,
      unitType: unit?.unit_type ?? null,
    };
  });

  const correspondence = (correspondenceResult.data ?? []).map((letter: any) => {
    const author = Array.isArray(letter.author) ? letter.author[0] : letter.author;
    return {
      id: letter.id,
      subject: letter.subject,
      body: letter.body,
      sentAt: letter.sent_at,
      author: author ? { displayName: author.display_name, rank: author.rank } : null,
    };
  });

  return {
    profile: {
      id: profile.id,
      personnelId: profile.personnel_id,
      displayName: profile.display_name,
      greetingName: profile.greeting_name,
      rank: profile.rank,
      callSign: profile.call_sign,
      division: profile.division,
      supervisorLabel: profile.supervisor_label,
      status: profile.status,
      accessTier: profile.access_tier,
      joinedAt: profile.created_at,
      probationStartedAt: profile.probation_started_at,
      probationEndsAt: profile.probation_ends_at,
      isTestAccount: profile.is_test_account,
      frameworkRank: getLscsoRankForGrade(jobGrade),
      rankMatchesFramework: profile.rank === getLscsoRankForGrade(jobGrade),
    },
    summary: {
      disciplinaryPoints: pointTotal,
      disciplinaryTier: currentTier
        ? {
            name: currentTier.tier_name,
            standing: currentTier.standing_label,
            actionRequired: currentTier.action_required,
            color: currentTier.color_key,
          }
        : null,
      currentCertifications: certifications.filter((item: any) => item.status === "Current").length,
      expiringCertifications: expiringSoon.length,
      expiredCertifications: expired.length,
      openRequests: openRequests.length + openLeaveRequests.length,
      pendingAcknowledgments: pendingAcknowledgments.length,
      awards: (awardsResult.data ?? []).length,
      activeLeave: activeLeave
        ? {
            requestNumber: `LOA-${String(activeLeave.request_number).padStart(4, "0")}`,
            leaveType: activeLeave.leave_type,
            startsOn: activeLeave.starts_on,
            expectedReturnOn: activeLeave.expected_return_on,
          }
        : null,
    },
    attention,
    guardians,
    discipline: {
      points: pointTotal,
      tier: currentTier,
      events: pointEvents,
    },
    certifications,
    training: trainingResult.data ?? [],
    personnelRequests,
    leaveRequests: leaveRequests.map((request: any) => ({
      id: request.id,
      requestNumber: `LOA-${String(request.request_number).padStart(4, "0")}`,
      leaveType: request.leave_type,
      startsOn: request.starts_on,
      expectedReturnOn: request.expected_return_on,
      notes: request.notes,
      status: request.status,
      reviewNotes: request.review_notes,
      reviewedAt: request.reviewed_at,
      createdAt: request.created_at,
      updatedAt: request.updated_at,
    })),
    awards: awardsResult.data ?? [],
    assignments,
    assignmentHistory: assignmentHistoryResult.data ?? [],
    flags: flagsResult.data ?? [],
    correspondence,
    notifications: notificationsResult.data ?? [],
    requestOptions: {
      divisions: (divisionsResult.data ?? [])
        .filter((unit: any) => unit.name !== profile.division && unit.name !== "Office of the Sheriff")
        .map((unit: any) => ({ id: unit.id, name: unit.name })),
      requestTypes: ["Promotion", "Division Transfer", "Certification", "Other"],
      leaveTypes: Array.from(LEAVE_TYPES),
    },
  };
}

async function submitLeave(identity: VerifiedIdentity, body: Record<string, unknown>) {
  const leaveType = cleanString(body.leaveType, 40);
  const startsOn = cleanString(body.startsOn, 10);
  const expectedReturnOn = cleanString(body.expectedReturnOn, 10);
  const notes = cleanString(body.notes, 1200);

  if (!LEAVE_TYPES.has(leaveType)) {
    return { error: "Select a valid leave type.", status: 400 };
  }
  if (!isDateOnly(startsOn) || !isDateOnly(expectedReturnOn) || expectedReturnOn < startsOn) {
    return { error: "Expected return date must be on or after the LOA start date.", status: 400 };
  }

  const { data: overlaps, error: overlapError } = await identity.admin
    .from("leave_requests")
    .select("id,request_number,status")
    .eq("profile_id", identity.profile.id)
    .in("status", ["Submitted", "In Review", "Approved"])
    .lte("starts_on", expectedReturnOn)
    .gte("expected_return_on", startsOn)
    .limit(1);
  if (overlapError) throw overlapError;
  if (overlaps?.length) {
    return { error: "An open or approved LOA already overlaps those dates.", status: 409 };
  }

  const { data, error } = await identity.admin
    .from("leave_requests")
    .insert({
      profile_id: identity.profile.id,
      leave_type: leaveType,
      starts_on: startsOn,
      expected_return_on: expectedReturnOn,
      notes: notes || null,
      status: "Submitted",
    })
    .select("request_number")
    .single();
  if (error) throw error;

  return {
    created: `LOA-${String(data.request_number).padStart(4, "0")}`,
  };
}

async function submitPersonnelRequest(identity: VerifiedIdentity, body: Record<string, unknown>) {
  const requestType = cleanString(body.requestType, 40);
  const details = cleanString(body.details, 1200);
  const effectiveDate = cleanString(body.effectiveDate, 10);
  const requestedUnitId = cleanString(body.requestedUnitId, 80);

  if (!REQUEST_TYPES.has(requestType)) {
    return { error: "Select a valid request type.", status: 400 };
  }
  if (details.length < 10) {
    return { error: "Add a brief operational explanation before submitting this request.", status: 400 };
  }
  if (effectiveDate && !isDateOnly(effectiveDate)) {
    return { error: "Preferred effective date is invalid.", status: 400 };
  }

  let unitId: string | null = null;
  if (requestType === "Division Transfer") {
    if (!requestedUnitId) {
      return { error: "Choose the division you are requesting.", status: 400 };
    }
    const { data: unit, error: unitError } = await identity.admin
      .from("organizational_units")
      .select("id,name")
      .eq("id", requestedUnitId)
      .eq("active", true)
      .eq("unit_type", "Division")
      .maybeSingle();
    if (unitError) throw unitError;
    if (!unit || unit.name === "Office of the Sheriff") {
      return { error: "The requested division is not available for transfer.", status: 400 };
    }
    unitId = unit.id;
  }

  const subjectByType: Record<string, string> = {
    Promotion: "Promotion consideration",
    "Division Transfer": "Division transfer",
    Certification: "Certification addition",
    Other: "Record review",
  };

  const { data, error } = await identity.admin
    .from("personnel_requests")
    .insert({
      requester_profile_id: identity.profile.id,
      request_type: requestType,
      subject: subjectByType[requestType],
      details,
      requested_effective_at: effectiveDate ? new Date(`${effectiveDate}T12:00:00Z`).toISOString() : null,
      requested_unit_id: unitId,
      status: "Submitted",
      is_test_record: Boolean(identity.profile.is_test_account),
    })
    .select("request_number")
    .single();
  if (error) throw error;

  return {
    created: `RQ-${String(data.request_number).padStart(4, "0")}`,
  };
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  if (!body) {
    return noStoreJson({ ok: false, code: "invalid_request", error: "A JSON request body is required." }, 400);
  }

  try {
    const verified = await verifyIdentity(request, body);
    if (verified instanceof NextResponse) return verified;

    const action = cleanString(body.action, 40).toLowerCase() || "read";
    let result: { created?: string; error?: string; status?: number } | null = null;

    if (action === "submit_leave") {
      result = await submitLeave(verified, body);
    } else if (action === "submit_request") {
      result = await submitPersonnelRequest(verified, body);
    } else if (action !== "read") {
      return noStoreJson({ ok: false, code: "unsupported_action", error: "Unsupported MyHR action." }, 400);
    }

    if (result?.error) {
      return noStoreJson({ ok: false, code: "validation_error", error: result.error }, result.status ?? 400);
    }

    const myhr = await loadMyHR(verified);
    return noStoreJson({ ok: true, created: result?.created ?? null, myhr });
  } catch (error) {
    console.error("[FiveM MyHR] integration failure", error);
    return noStoreJson(
      { ok: false, code: "backend_error", error: "LSCSO MyHR request failed." },
      500,
    );
  }
}
