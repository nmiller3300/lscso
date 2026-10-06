import { createClient } from "npm:@supabase/supabase-js@2";

const MOBILE_TOKEN_SHA256 = "b3df6d480ecdcdf3be9e5dae91e782a05fbbaefb926a0292067cb5e4217768df";
const TABLET_TOKEN_SHA256 = "52b116f186eb327dc5d897040927d6218b6e01a9eb79be380ca6c65fc8db9897";
const LSCSO_JOB_NAME = "lscso";
const LSCSO_GRADES = {
  0: "Recruit",
  1: "Deputy",
  2: "Deputy II",
  3: "Deputy III",
  4: "Master Deputy",
  5: "Corporal",
  6: "Sergeant",
  7: "Lieutenant",
  8: "1st Lieutenant",
  9: "Captain",
  10: "Major",
  11: "Undersheriff",
  12: "Sheriff",
};
const CLOSED_REQUEST_STATUSES = ["Approved", "Denied", "Cancelled", "Completed"];
const LEAVE_TYPES = new Set(["Personal", "Medical", "Military", "Family", "Administrative", "Other"]);
const REQUEST_TYPES = new Set(["Promotion", "Division Transfer", "Certification", "Other"]);
const CODE_TTL_MINUTES = 10;

function jsonResponse(payload, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}

function cleanString(value, maxLength) {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

function isDateOnly(value) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(new Date(`${value}T12:00:00Z`).getTime());
}

function isLscsoGrade(value) {
  return Number.isInteger(value) && value >= 0 && value <= 12;
}

function rankForGrade(value) {
  return LSCSO_GRADES[value] ?? null;
}

function toInternalEmail(username) {
  return `${username.trim().toLowerCase()}@auth.lscso.internal`;
}

function splitDisplayName(displayName, greetingName) {
  const parts = String(displayName || "").trim().split(/\s+/).filter(Boolean);
  return {
    firstName: String(greetingName || "").trim() || parts[0] || "Deputy",
    lastName: parts.length > 1 ? parts.slice(1).join(" ") : "",
  };
}

async function sha256Hex(value) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest)).map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function constantTimeHexEqual(left, right) {
  if (left.length !== right.length) return false;
  let diff = 0;
  for (let i = 0; i < left.length; i += 1) diff |= left.charCodeAt(i) ^ right.charCodeAt(i);
  return diff === 0;
}

async function authorizeRequest(request) {
  const mobileHeader = request.headers.get("x-aegis-lscso-mobile") === "1";
  if (!mobileHeader) return false;
  const authorization = request.headers.get("authorization") || "";
  const match = authorization.match(/^Bearer\s+(.+)$/i);
  const token = match?.[1]?.trim() || "";
  if (!token) return false;
  const digest = await sha256Hex(token);
  return constantTimeHexEqual(digest, MOBILE_TOKEN_SHA256) || constantTimeHexEqual(digest, TABLET_TOKEN_SHA256);
}

function getClients() {
  const url = Deno.env.get("SUPABASE_URL") || "";
  const anon = Deno.env.get("SUPABASE_ANON_KEY") || "";
  const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
  if (!url || !anon || !service) throw new Error("Supabase function environment is incomplete.");
  const auth = createClient(url, anon, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } });
  const admin = createClient(url, service, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } });
  return { auth, admin };
}

function validateFrameworkIdentity(body) {
  const citizenId = cleanString(body?.citizenId, 100);
  const license = cleanString(body?.license, 160);
  const jobName = cleanString(body?.jobName, 64).toLowerCase();
  const jobGrade = Number(body?.jobGrade);
  if (!citizenId || !license) {
    return { error: jsonResponse({ ok: false, code: "invalid_identity", error: "Citizen ID and license are required." }, 400) };
  }
  if (jobName !== LSCSO_JOB_NAME || !isLscsoGrade(jobGrade)) {
    return { error: jsonResponse({ ok: false, code: "invalid_lscso_job", error: "Active LSCSO employment is required." }, 403) };
  }
  return { citizenId, license, jobName, jobGrade };
}

async function signInCredentials(username, password) {
  const { auth } = getClients();
  const { data, error } = await auth.auth.signInWithPassword({ email: toInternalEmail(username), password });
  if (error || !data.user) return { error: "invalid_credentials", auth };
  if (data.user.user_metadata?.must_change_password === true) return { error: "account_setup_required", auth };
  return { user: data.user, auth };
}

async function handlePairingCreate(body) {
  const username = cleanString(body?.username, 80).toLowerCase();
  const password = cleanString(body?.password, 256);
  if (!username || !password) return jsonResponse({ ok: false, code: "invalid_credentials_request", error: "Username and password are required." }, 400);
  const signed = await signInCredentials(username, password);
  try {
    if (signed.error === "invalid_credentials") return jsonResponse({ ok: false, code: "invalid_credentials", error: "The LSCSO username or password is incorrect." }, 401);
    if (signed.error === "account_setup_required") return jsonResponse({ ok: false, code: "account_setup_required", error: "Complete your first-time password change before linking a FiveM character." }, 403);
    const { admin } = getClients();
    const { data: profile, error: profileError } = await admin.from("personnel_profiles").select("id,personnel_id,display_name,rank,status").eq("auth_user_id", signed.user.id).maybeSingle();
    if (profileError) throw profileError;
    if (!profile || !["Active", "Acting"].includes(profile.status)) return jsonResponse({ ok: false, code: "profile_inactive", error: "This LSCSO personnel account is not active." }, 403);
    const { data: existingLink, error: existingLinkError } = await admin.from("fivem_identity_links").select("citizen_id,linked_at,last_seen_at").eq("personnel_profile_id", profile.id).eq("active", true).maybeSingle();
    if (existingLinkError) throw existingLinkError;
    if (existingLink) return jsonResponse({ ok: true, connected: true, account: { personnelId: profile.personnel_id, displayName: profile.display_name, rank: profile.rank } });
    const now = new Date();
    const expiresAt = new Date(now.getTime() + CODE_TTL_MINUTES * 60_000).toISOString();
    await admin.from("fivem_pairing_codes").delete().eq("personnel_profile_id", profile.id).is("consumed_at", null);
    await admin.from("fivem_pairing_codes").delete().lt("expires_at", new Date(now.getTime() - 86_400_000).toISOString());
    for (let attempt = 0; attempt < 10; attempt += 1) {
      const values = new Uint32Array(1);
      crypto.getRandomValues(values);
      const code = String(values[0] % 1_000_000).padStart(6, "0");
      const codeHash = await sha256Hex(code);
      const { error: insertError } = await admin.from("fivem_pairing_codes").insert({ personnel_profile_id: profile.id, code_hash: codeHash, expires_at: expiresAt });
      if (!insertError) return jsonResponse({ ok: true, connected: false, code, expiresAt, account: { personnelId: profile.personnel_id, displayName: profile.display_name, rank: profile.rank } });
      if (insertError.code !== "23505") throw insertError;
    }
    return jsonResponse({ ok: false, code: "pairing_code_unavailable", error: "A unique pairing code could not be created. Try again." }, 503);
  } finally {
    if (signed.auth) await signed.auth.auth.signOut().catch(() => undefined);
  }
}

async function handlePair(body) {
  const identity = validateFrameworkIdentity(body);
  if (identity.error) return identity.error;
  const code = cleanString(body?.code, 6);
  if (!/^\d{6}$/.test(code)) return jsonResponse({ ok: false, code: "invalid_pairing_request", error: "A valid 6-digit pairing code and FiveM identity are required." }, 400);
  const { admin } = getClients();
  const codeHash = await sha256Hex(code);
  const now = new Date().toISOString();
  const { data: pairing, error: pairingError } = await admin.from("fivem_pairing_codes").select("id,personnel_profile_id,expires_at,consumed_at").eq("code_hash", codeHash).is("consumed_at", null).gt("expires_at", now).maybeSingle();
  if (pairingError) throw pairingError;
  if (!pairing) return jsonResponse({ ok: false, code: "pairing_code_invalid", error: "That pairing code is invalid or has expired." }, 404);
  const { data: profile, error: profileError } = await admin.from("personnel_profiles").select("id,personnel_id,display_name,rank,status").eq("id", pairing.personnel_profile_id).maybeSingle();
  if (profileError) throw profileError;
  if (!profile || !["Active", "Acting"].includes(profile.status)) return jsonResponse({ ok: false, code: "profile_inactive", error: "The personnel account for this pairing code is not active." }, 409);
  const { data: citizenLink, error: citizenLinkError } = await admin.from("fivem_identity_links").select("id,personnel_profile_id,citizen_id").eq("citizen_id", identity.citizenId).eq("active", true).maybeSingle();
  if (citizenLinkError) throw citizenLinkError;
  if (citizenLink && citizenLink.personnel_profile_id !== profile.id) return jsonResponse({ ok: false, code: "citizen_already_linked", error: "This FiveM character is already linked to another LSCSO account." }, 409);
  const { data: profileLink, error: profileLinkError } = await admin.from("fivem_identity_links").select("id,citizen_id").eq("personnel_profile_id", profile.id).eq("active", true).maybeSingle();
  if (profileLinkError) throw profileLinkError;
  if (profileLink && profileLink.citizen_id !== identity.citizenId) return jsonResponse({ ok: false, code: "profile_already_linked", error: "This LSCSO account is already linked to another FiveM character." }, 409);
  if (citizenLink || profileLink) {
    const linkId = citizenLink?.id ?? profileLink?.id;
    const { error: updateError } = await admin.from("fivem_identity_links").update({ license_identifier: identity.license, last_seen_at: now, last_seen_grade: identity.jobGrade, updated_at: now }).eq("id", linkId);
    if (updateError) throw updateError;
  } else {
    const { error: insertError } = await admin.from("fivem_identity_links").insert({ personnel_profile_id: profile.id, citizen_id: identity.citizenId, license_identifier: identity.license, active: true, linked_by: profile.id, last_seen_at: now, last_seen_grade: identity.jobGrade, updated_at: now });
    if (insertError) throw insertError;
  }
  const { error: consumeError } = await admin.from("fivem_pairing_codes").update({ consumed_at: now }).eq("id", pairing.id).is("consumed_at", null);
  if (consumeError) throw consumeError;
  return jsonResponse({ ok: true, link: { personnelId: profile.personnel_id, displayName: profile.display_name, personnelRank: profile.rank, citizenId: identity.citizenId, jobGrade: identity.jobGrade } });
}

async function handleGovernmentAuth(body) {
  const username = cleanString(body?.username, 80).toLowerCase();
  const password = cleanString(body?.password, 256);
  const identity = validateFrameworkIdentity(body);
  if (identity.error) return identity.error;
  if (!username || !password) return jsonResponse({ ok: false, code: "invalid_credentials_request", error: "Username, password, and FiveM identity are required." }, 400);
  const signed = await signInCredentials(username, password);
  try {
    if (signed.error === "invalid_credentials") return jsonResponse({ ok: false, code: "invalid_credentials", error: "The LSCSO username or password is incorrect." }, 401);
    if (signed.error === "account_setup_required") return jsonResponse({ ok: false, code: "account_setup_required", error: "Complete your first-time password change in the Personnel Portal before using this workstation." }, 403);
    const { admin } = getClients();
    const { data: profile, error: profileError } = await admin.from("personnel_profiles").select("id,personnel_id,display_name,greeting_name,rank,call_sign,division,status").eq("auth_user_id", signed.user.id).maybeSingle();
    if (profileError) throw profileError;
    if (!profile || !["Active", "Acting"].includes(profile.status)) return jsonResponse({ ok: false, code: "profile_inactive", error: "This LSCSO personnel account is not active." }, 403);
    const { data: link, error: linkError } = await admin.from("fivem_identity_links").select("id,citizen_id,license_identifier,active").eq("personnel_profile_id", profile.id).eq("active", true).maybeSingle();
    if (linkError) throw linkError;
    if (!link || link.citizen_id !== identity.citizenId) return jsonResponse({ ok: false, code: "character_not_linked", error: "These LSCSO credentials are not linked to this FiveM character." }, 403);
    if (link.license_identifier && link.license_identifier !== identity.license) return jsonResponse({ ok: false, code: "identity_mismatch", error: "The linked FiveM identity does not match this character license." }, 403);
    const expectedRank = rankForGrade(identity.jobGrade);
    if (profile.rank !== expectedRank) return jsonResponse({ ok: false, code: "rank_mismatch", error: "Your active department rank does not match your personnel record. Contact Command Staff." }, 409);
    const now = new Date().toISOString();
    const { error: updateError } = await admin.from("fivem_identity_links").update({ license_identifier: identity.license, last_seen_at: now, last_seen_grade: identity.jobGrade, updated_at: now }).eq("id", link.id);
    if (updateError) throw updateError;
    const { firstName, lastName } = splitDisplayName(profile.display_name, profile.greeting_name);
    return jsonResponse({ ok: true, user: { firstName, lastName, rank: profile.rank, badge: profile.call_sign || profile.personnel_id, personnelId: profile.personnel_id, division: profile.division } });
  } finally {
    if (signed.auth) await signed.auth.auth.signOut().catch(() => undefined);
  }
}

async function verifyIdentity(body) {
  const framework = validateFrameworkIdentity(body);
  if (framework.error) return { response: framework.error };
  const { admin } = getClients();
  const { data: link, error: linkError } = await admin.from("fivem_identity_links").select("id,personnel_profile_id,license_identifier,active").eq("citizen_id", framework.citizenId).eq("active", true).maybeSingle();
  if (linkError) throw linkError;
  if (!link) return { response: jsonResponse({ ok: false, code: "identity_not_linked", error: "This FiveM character is not linked to an LSCSO personnel record." }, 404) };
  if (link.license_identifier && link.license_identifier !== framework.license) return { response: jsonResponse({ ok: false, code: "identity_mismatch", error: "The linked FiveM identity does not match this character license." }, 403) };
  const { data: profile, error: profileError } = await admin.from("personnel_profiles").select("id,personnel_id,display_name,greeting_name,rank,access_tier,call_sign,division,supervisor_label,status,is_test_account,created_at,probation_started_at,probation_ends_at").eq("id", link.personnel_profile_id).maybeSingle();
  if (profileError) throw profileError;
  if (!profile) return { response: jsonResponse({ ok: false, code: "profile_missing", error: "Linked LSCSO personnel record was not found." }, 404) };
  if (!["Active", "Acting"].includes(profile.status)) return { response: jsonResponse({ ok: false, code: "profile_inactive", error: "This LSCSO personnel record is not active." }, 403) };
  const now = new Date().toISOString();
  const update = { last_seen_at: now, last_seen_grade: framework.jobGrade, updated_at: now };
  if (!link.license_identifier) update.license_identifier = framework.license;
  const { error: updateError } = await admin.from("fivem_identity_links").update(update).eq("id", link.id);
  if (updateError) throw updateError;
  return { admin, link, profile, ...framework };
}

async function loadMyHR(identity) {
  const { admin, profile, jobGrade } = identity;
  const profileId = profile.id;
  const [certificationsResult, assignmentsResult, assignmentHistoryResult, guardiansResult, requestsResult, trainingResult, notificationsResult, awardsResult, flagsResult, pointEventsResult, tiersResult, correspondenceResult, leaveResult, acknowledgmentsResult, divisionsResult] = await Promise.all([
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
  const results = [certificationsResult, assignmentsResult, assignmentHistoryResult, guardiansResult, requestsResult, trainingResult, notificationsResult, awardsResult, flagsResult, pointEventsResult, tiersResult, correspondenceResult, leaveResult, acknowledgmentsResult, divisionsResult];
  const failed = results.find((result) => result.error);
  if (failed?.error) throw failed.error;
  const requests = requestsResult.data || [];
  const requestIds = requests.map((request) => request.id);
  let routeEvents = [];
  if (requestIds.length) {
    const { data, error } = await admin.from("personnel_request_route_events").select("id,request_id,event_type,stage_label,reviewer_label,actor_label,detail,created_at").in("request_id", requestIds).order("created_at", { ascending: true });
    if (error) throw error;
    routeEvents = data || [];
  }
  const pointEvents = pointEventsResult.data || [];
  const pointTotal = Math.max(0, pointEvents.reduce((sum, event) => sum + Number(event.delta || 0), 0));
  const tiers = tiersResult.data || [];
  const currentTier = tiers.find((tier) => pointTotal >= Number(tier.min_points) && pointTotal <= Number(tier.max_points)) || tiers[tiers.length - 1] || null;
  const acknowledgments = new Map((acknowledgmentsResult.data || []).map((row) => [row.guardian_id, row]));
  const guardians = (guardiansResult.data || []).map((record) => {
    const author = Array.isArray(record.author) ? record.author[0] : record.author;
    const acknowledgment = acknowledgments.get(record.id);
    return { id: record.id, guardianNumber: `G-${String(record.guardian_number).padStart(4, "0")}`, recordType: record.record_type, status: record.status, title: record.title, incidentAt: record.incident_at, location: record.location, policyReference: record.policy_reference, observedBehavior: record.observed_behavior, expectedStandard: record.expected_standard, actionTaken: record.action_taken, followUpPlan: record.follow_up_plan, followUpDueAt: record.follow_up_due_at, pointsAssessed: Number(record.points_assessed || 0), employeeResponse: record.employee_response, issuedAt: record.issued_at, closedAt: record.closed_at, createdAt: record.created_at, author: author ? { displayName: author.display_name, rank: author.rank } : null, acknowledgment: record.acknowledged_at || acknowledgment ? { signedAt: acknowledgment?.signed_at || record.acknowledged_at, responseText: acknowledgment?.response_text || record.employee_response } : null };
  });
  const routesByRequest = new Map();
  for (const event of routeEvents) {
    const list = routesByRequest.get(event.request_id) || [];
    list.push({ id: event.id, eventType: event.event_type, stageLabel: event.stage_label, reviewerLabel: event.reviewer_label, actorLabel: event.actor_label, detail: event.detail, createdAt: event.created_at });
    routesByRequest.set(event.request_id, list);
  }
  const divisionNames = new Map((divisionsResult.data || []).map((unit) => [String(unit.id), String(unit.name)]));
  const personnelRequests = requests.map((request) => ({ id: request.id, requestNumber: `RQ-${String(request.request_number).padStart(4, "0")}`, requestType: request.request_type, subject: request.subject, details: request.details, status: request.status, requestedEffectiveAt: request.requested_effective_at, requestedUnitId: request.requested_unit_id, requestedUnitName: request.requested_unit_id ? divisionNames.get(String(request.requested_unit_id)) || null : null, currentReviewerLabel: request.current_reviewer_label, routingStage: request.routing_stage, routingLabel: request.routing_label, decisionNotes: request.decision_notes, decidedAt: request.decided_at, createdAt: request.created_at, updatedAt: request.updated_at, routeEvents: routesByRequest.get(request.id) || [] }));
  const certifications = certificationsResult.data || [];
  const now = new Date();
  const expiringSoon = certifications.filter((certification) => {
    if (certification.status !== "Current" || !certification.expires_on) return false;
    const expires = new Date(`${certification.expires_on}T23:59:59`);
    const days = (expires.getTime() - now.getTime()) / 86_400_000;
    return days >= 0 && days <= 30;
  });
  const expired = certifications.filter((certification) => !certification.expires_on ? certification.status === "Expired" : new Date(`${certification.expires_on}T23:59:59`).getTime() < now.getTime());
  const leaveRequests = leaveResult.data || [];
  const today = now.toISOString().slice(0, 10);
  const activeLeave = leaveRequests.find((leave) => leave.status === "Approved" && leave.starts_on <= today && leave.expected_return_on >= today) || null;
  const pendingAcknowledgments = guardians.filter((record) => !record.acknowledgment && !["Draft", "Pending Approval", "Denied", "Closed"].includes(record.status));
  const openRequests = personnelRequests.filter((request) => !CLOSED_REQUEST_STATUSES.includes(request.status));
  const openLeaveRequests = leaveRequests.filter((request) => !CLOSED_REQUEST_STATUSES.includes(request.status));
  const attention = [];
  for (const guardian of pendingAcknowledgments.slice(0, 3)) attention.push({ type: "guardian", severity: "action", title: `${guardian.guardianNumber} requires acknowledgment`, detail: guardian.title || guardian.recordType });
  for (const certification of expiringSoon.slice(0, 3)) attention.push({ type: "certification", severity: "warning", title: `${certification.name} expires soon`, detail: `Expires ${certification.expires_on}` });
  if (activeLeave) attention.push({ type: "leave", severity: "info", title: "Leave of Absence active", detail: `Expected return ${activeLeave.expected_return_on}` });
  const assignments = (assignmentsResult.data || []).map((assignment) => {
    const unit = Array.isArray(assignment.organizational_units) ? assignment.organizational_units[0] : assignment.organizational_units;
    return { id: assignment.id, assignmentType: assignment.assignment_type, startsAt: assignment.starts_at, endsAt: assignment.ends_at, notes: assignment.notes, unitName: unit?.name || null, unitType: unit?.unit_type || null };
  });
  const correspondence = (correspondenceResult.data || []).map((letter) => {
    const author = Array.isArray(letter.author) ? letter.author[0] : letter.author;
    return { id: letter.id, subject: letter.subject, body: letter.body, sentAt: letter.sent_at, author: author ? { displayName: author.display_name, rank: author.rank } : null };
  });
  return { profile: { id: profile.id, personnelId: profile.personnel_id, displayName: profile.display_name, greetingName: profile.greeting_name, rank: profile.rank, callSign: profile.call_sign, division: profile.division, supervisorLabel: profile.supervisor_label, status: profile.status, accessTier: profile.access_tier, joinedAt: profile.created_at, probationStartedAt: profile.probation_started_at, probationEndsAt: profile.probation_ends_at, isTestAccount: profile.is_test_account, frameworkRank: rankForGrade(jobGrade), rankMatchesFramework: profile.rank === rankForGrade(jobGrade) }, summary: { disciplinaryPoints: pointTotal, disciplinaryTier: currentTier ? { name: currentTier.tier_name, standing: currentTier.standing_label, actionRequired: currentTier.action_required, color: currentTier.color_key } : null, currentCertifications: certifications.filter((item) => item.status === "Current").length, expiringCertifications: expiringSoon.length, expiredCertifications: expired.length, openRequests: openRequests.length + openLeaveRequests.length, pendingAcknowledgments: pendingAcknowledgments.length, awards: (awardsResult.data || []).length, activeLeave: activeLeave ? { requestNumber: `LOA-${String(activeLeave.request_number).padStart(4, "0")}`, leaveType: activeLeave.leave_type, startsOn: activeLeave.starts_on, expectedReturnOn: activeLeave.expected_return_on } : null }, attention, guardians, discipline: { points: pointTotal, tier: currentTier, events: pointEvents }, certifications, training: trainingResult.data || [], personnelRequests, leaveRequests: leaveRequests.map((request) => ({ id: request.id, requestNumber: `LOA-${String(request.request_number).padStart(4, "0")}`, leaveType: request.leave_type, startsOn: request.starts_on, expectedReturnOn: request.expected_return_on, notes: request.notes, status: request.status, reviewNotes: request.review_notes, reviewedAt: request.reviewed_at, createdAt: request.created_at, updatedAt: request.updated_at })), awards: awardsResult.data || [], assignments, assignmentHistory: assignmentHistoryResult.data || [], flags: flagsResult.data || [], correspondence, notifications: notificationsResult.data || [], requestOptions: { divisions: (divisionsResult.data || []).filter((unit) => unit.name !== profile.division && unit.name !== "Office of the Sheriff").map((unit) => ({ id: unit.id, name: unit.name })), requestTypes: ["Promotion", "Division Transfer", "Certification", "Other"], leaveTypes: Array.from(LEAVE_TYPES) } };
}

async function submitLeave(identity, body) {
  const leaveType = cleanString(body?.leaveType, 40);
  const startsOn = cleanString(body?.startsOn, 10);
  const expectedReturnOn = cleanString(body?.expectedReturnOn, 10);
  const notes = cleanString(body?.notes, 1200);
  if (!LEAVE_TYPES.has(leaveType)) return { error: "Select a valid leave type.", status: 400 };
  if (!isDateOnly(startsOn) || !isDateOnly(expectedReturnOn) || expectedReturnOn < startsOn) return { error: "Expected return date must be on or after the LOA start date.", status: 400 };
  const { data: overlaps, error: overlapError } = await identity.admin.from("leave_requests").select("id,request_number,status").eq("profile_id", identity.profile.id).in("status", ["Submitted", "In Review", "Approved"]).lte("starts_on", expectedReturnOn).gte("expected_return_on", startsOn).limit(1);
  if (overlapError) throw overlapError;
  if (overlaps?.length) return { error: "An open or approved LOA already overlaps those dates.", status: 409 };
  const { data, error } = await identity.admin.from("leave_requests").insert({ profile_id: identity.profile.id, leave_type: leaveType, starts_on: startsOn, expected_return_on: expectedReturnOn, notes: notes || null, status: "Submitted" }).select("request_number").single();
  if (error) throw error;
  return { created: `LOA-${String(data.request_number).padStart(4, "0")}` };
}

async function submitPersonnelRequest(identity, body) {
  const requestType = cleanString(body?.requestType, 40);
  const details = cleanString(body?.details, 1200);
  const effectiveDate = cleanString(body?.effectiveDate, 10);
  const requestedUnitId = cleanString(body?.requestedUnitId, 80);
  if (!REQUEST_TYPES.has(requestType)) return { error: "Select a valid request type.", status: 400 };
  if (details.length < 10) return { error: "Add a brief operational explanation before submitting this request.", status: 400 };
  if (effectiveDate && !isDateOnly(effectiveDate)) return { error: "Preferred effective date is invalid.", status: 400 };
  let unitId = null;
  if (requestType === "Division Transfer") {
    if (!requestedUnitId) return { error: "Choose the division you are requesting.", status: 400 };
    const { data: unit, error: unitError } = await identity.admin.from("organizational_units").select("id,name").eq("id", requestedUnitId).eq("active", true).eq("unit_type", "Division").maybeSingle();
    if (unitError) throw unitError;
    if (!unit || unit.name === "Office of the Sheriff") return { error: "The requested division is not available for transfer.", status: 400 };
    unitId = unit.id;
  }
  const subjectByType = { Promotion: "Promotion consideration", "Division Transfer": "Division transfer", Certification: "Certification addition", Other: "Record review" };
  const { data, error } = await identity.admin.from("personnel_requests").insert({ requester_profile_id: identity.profile.id, request_type: requestType, subject: subjectByType[requestType], details, requested_effective_at: effectiveDate ? new Date(`${effectiveDate}T12:00:00Z`).toISOString() : null, requested_unit_id: unitId, status: "Submitted", is_test_record: Boolean(identity.profile.is_test_account) }).select("request_number").single();
  if (error) throw error;
  return { created: `RQ-${String(data.request_number).padStart(4, "0")}` };
}

async function handleMyHR(body) {
  const identity = await verifyIdentity(body);
  if (identity.response) return identity.response;
  const action = cleanString(body?.action, 40).toLowerCase() || "read";
  let result = null;
  if (action === "submit_leave") result = await submitLeave(identity, body);
  else if (action === "submit_request") result = await submitPersonnelRequest(identity, body);
  else if (action !== "read") return jsonResponse({ ok: false, code: "unsupported_action", error: "Unsupported MyHR action." }, 400);
  if (result?.error) return jsonResponse({ ok: false, code: "validation_error", error: result.error }, result.status || 400);
  const myhr = await loadMyHR(identity);
  return jsonResponse({ ok: true, created: result?.created || null, myhr });
}


async function handleGuardian(body) {
  const identity = await verifyIdentity(body);
  if (identity.response) return identity.response;

  const { admin, profile } = identity;
  const action = cleanString(body?.action, 40).toLowerCase() || "read";

  if (action === "create") {
    const recordType = cleanString(body?.recordType, 40);
    const title = cleanString(body?.title, 160);
    const observedBehavior = cleanString(body?.observedBehavior, 10000);
    const subjectProfileId = cleanString(body?.subjectProfileId, 80);
    const points = Number(body?.points ?? 0);
    const incidentRaw = cleanString(body?.incidentAt, 80);
    const followUpRaw = cleanString(body?.followUpDueAt, 80);
    if (!subjectProfileId || !title || observedBehavior.length < 10) {
      return jsonResponse({ ok:false, code:"validation_error", error:"Choose a member and add a complete Guardian narrative." }, 400);
    }
    const { data, error } = await admin.rpc("tablet_guardian_create", {
      p_actor_profile_id: profile.id,
      p_subject_profile_id: subjectProfileId,
      p_record_type: recordType,
      p_title: title,
      p_incident_at: incidentRaw || new Date().toISOString(),
      p_location: cleanString(body?.location, 240) || null,
      p_policy_reference: cleanString(body?.policyReference, 1000) || null,
      p_observed_behavior: observedBehavior,
      p_expected_standard: cleanString(body?.expectedStandard, 10000) || null,
      p_action_taken: cleanString(body?.actionTaken, 10000) || null,
      p_follow_up_plan: cleanString(body?.followUpPlan, 4000) || null,
      p_follow_up_due_at: followUpRaw || null,
      p_points: Number.isInteger(points) ? points : 0,
      p_draft: body?.draft === true,
    });
    if (error) return jsonResponse({ ok:false, code:"guardian_create_failed", error:error.message }, 409);
    return jsonResponse({ ok:true, record:data });
  }

  if (action === "review") {
    const decision = cleanString(body?.decision, 20);
    const notes = cleanString(body?.notes, 4000);
    const recordId = cleanString(body?.recordId, 80);
    if (!recordId || !["Approved","Denied"].includes(decision) || notes.length < 4) {
      return jsonResponse({ ok:false, code:"validation_error", error:"Enter a Guardian decision and review notes." }, 400);
    }
    const { data, error } = await admin.rpc("tablet_guardian_review", {
      p_actor_profile_id: profile.id,
      p_record_id: recordId,
      p_decision: decision,
      p_notes: notes,
    });
    if (error) return jsonResponse({ ok:false, code:"guardian_review_failed", error:error.message }, 409);
    return jsonResponse({ ok:true, record:data });
  }

  if (action === "issue") {
    const recordId = cleanString(body?.recordId, 80);
    const { data, error } = await admin.rpc("tablet_guardian_issue", {
      p_actor_profile_id: profile.id,
      p_record_id: recordId,
    });
    if (error) return jsonResponse({ ok:false, code:"guardian_issue_failed", error:error.message }, 409);
    return jsonResponse({ ok:true, record:data });
  }

  if (action === "acknowledge") {
    const recordId = cleanString(body?.recordId, 80);
    const signature = cleanString(body?.signature, 160);
    const response = cleanString(body?.response, 4000);
    const { data, error } = await admin.rpc("tablet_guardian_acknowledge", {
      p_actor_profile_id: profile.id,
      p_record_id: recordId,
      p_signature: signature,
      p_response: response || null,
    });
    if (error) return jsonResponse({ ok:false, code:"guardian_acknowledge_failed", error:error.message }, 409);
    return jsonResponse({ ok:true, record:data });
  }

  if (action !== "read") {
    return jsonResponse({ ok:false, code:"unsupported_action", error:"Unsupported Guardian action." }, 400);
  }

  const [purviewResult, guardiansResult, rosterResult] = await Promise.all([
    admin.rpc("tablet_guardian_purview", { p_actor_profile_id: profile.id }),
    admin.from("guardian_records")
      .select("id,guardian_number,reference_number,subject_profile_id,author_profile_id,record_type,status,title,incident_at,location,policy_reference,observed_behavior,expected_standard,action_taken,follow_up_plan,follow_up_due_at,points_assessed,command_notes,submitted_at,approved_at,issued_at,acknowledged_at,closed_at,employee_response,created_at,updated_at")
      .order("created_at", { ascending:false })
      .limit(350),
    admin.from("personnel_profiles")
      .select("id,personnel_id,display_name,rank,call_sign,division,status,access_tier")
      .neq("status","Deactivated")
      .order("display_name"),
  ]);
  if (purviewResult.error) throw purviewResult.error;
  if (guardiansResult.error) throw guardiansResult.error;
  if (rosterResult.error) throw rosterResult.error;

  const purview = purviewResult.data || [];
  const purviewIds = new Set(purview.map((row) => String(row.profile_id)));
  const commandView = ["Executive","Command","Attorney"].includes(profile.access_tier);
  const supervisoryStatuses = new Set(["Approved","Issued","Awaiting Acknowledgment","Acknowledged","Follow-Up Due","Closed"]);
  const visible = (guardiansResult.data || []).filter((record) => {
    if (commandView) return true;
    if (record.author_profile_id === profile.id || record.subject_profile_id === profile.id) return true;
    return purviewIds.has(String(record.subject_profile_id)) && supervisoryStatuses.has(record.status);
  });

  const roster = rosterResult.data || [];
  const names = new Map(roster.map((row) => [String(row.id), row]));
  const guardians = visible.map((record) => ({
    ...record,
    subject: names.get(String(record.subject_profile_id)) || null,
    author: names.get(String(record.author_profile_id)) || null,
  }));

  return jsonResponse({
    ok:true,
    guardian:{
      profile:{
        id:profile.id,
        personnelId:profile.personnel_id,
        displayName:profile.display_name,
        rank:profile.rank,
        callSign:profile.call_sign,
        division:profile.division,
        status:profile.status,
        accessTier:profile.access_tier,
      },
      purview,
      guardians,
      canCreate: purview.length > 0,
      canCommandReview: ["Executive","Command"].includes(profile.access_tier),
      syncedAt:new Date().toISOString(),
    },
  });
}

Deno.serve(async (request) => {
  if (request.method === "GET") return jsonResponse({ ok: true, service: "lscso-fivem-mobile", version: "1.0.0", transport: "supabase-edge" });
  if (request.method !== "POST") return jsonResponse({ ok: false, error: "Method not allowed." }, 405);
  if (!(await authorizeRequest(request))) return jsonResponse({ ok: false, code: "unauthorized", error: "Unauthorized." }, 401);
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") return jsonResponse({ ok: false, code: "invalid_request", error: "A JSON request body is required." }, 400);
  const route = cleanString(body.__route, 120);
  try {
    if (route === "/api/integrations/fivem/mobile/pairing" || route === "pairingCreate") return await handlePairingCreate(body);
    if (route === "/api/integrations/fivem/pair" || route === "pair") return await handlePair(body);
    if (route === "/api/integrations/fivem/government-auth" || route === "governmentAuth") return await handleGovernmentAuth(body);
    if (route === "/api/integrations/fivem/myhr" || route === "myhr") return await handleMyHR(body);
    if (route === "guardian" || route === "/api/integrations/fivem/guardian") return await handleGuardian(body);
    return jsonResponse({ ok: false, code: "unsupported_route", error: "Unsupported LSCSO mobile route." }, 404);
  } catch (error) {
    console.error("[lscso-fivem-mobile] failure", error);
    return jsonResponse({ ok: false, code: "backend_error", error: "LSCSO mobile service failed." }, 500);
  }
});