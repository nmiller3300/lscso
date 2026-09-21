import { checked, fail, mobileContext, MobileError, reply, text, uuid } from "@/lib/integrations/fivem/mobile";

export const dynamic = "force-dynamic";
const guardianFields = "id,guardian_number,subject_profile_id,author_profile_id,record_type,status,title,incident_at,location,policy_reference,observed_behavior,expected_standard,action_taken,follow_up_plan,follow_up_due_at,points_assessed,acknowledged_at,employee_response,created_at,updated_at";
const kinds = ["Feedback", "Written Warning", "Write-Up", "Commendation"];
function date(value: unknown, required = false) {
  const s = text(value, 40);
  if (!s && !required) return null;
  if (!s || !Number.isFinite(Date.parse(s))) throw new MobileError("Enter a valid date.");
  return new Date(s).toISOString();
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { db, profile } = await mobileContext(request, body);
    const action = text(body.action, 40);
    if (action === "read") {
      const results = await Promise.all([
        db.from("personnel_profiles").select("id,personnel_id,display_name,rank,call_sign,division,supervisor_label,status").neq("status", "Deactivated").order("personnel_id"),
        db.from("guardian_records").select(guardianFields).order("created_at", { ascending: false }).limit(250),
        db.rpc("get_personnel_in_my_purview"),
        db.from("notifications").select("id,title,message,notification_type,read_at,created_at").eq("recipient_profile_id", profile.id).order("created_at", { ascending: false }).limit(60),
        db.from("certifications").select("id,name,status,issuer,certificate_number,issued_on,expires_on,notes").eq("profile_id", profile.id).order("name"),
        db.from("training_progress").select("id,program_type,phase,status,progress_percent,evaluation_notes").eq("profile_id", profile.id),
        db.from("personnel_requests").select("id,request_number,request_type,subject,details,status,created_at,current_reviewer_label,routing_label").eq("requester_profile_id", profile.id).order("created_at", { ascending: false }).limit(100),
        db.from("personnel_correspondence").select("id,subject,body,sent_at").eq("recipient_profile_id", profile.id).is("archived_at", null).order("sent_at", { ascending: false }).limit(100),
        db.from("command_announcements").select("id,title,body,priority,published_at,expires_at").eq("active", true).or(`expires_at.is.null,expires_at.gt.${new Date().toISOString()}`).order("published_at", { ascending: false }).limit(30),
        db.rpc("get_guardian_point_total", { target_profile_id: profile.id }),
        db.from("leave_requests").select("id,request_number,leave_type,starts_on,expected_return_on,notes,status,created_at").eq("profile_id", profile.id).order("created_at", { ascending: false }).limit(100),
        db.from("command_orders").select("id,order_number,title,body,target_audience,acknowledgment_required,effective_at,status").eq("status", "Active").order("order_number", { ascending: false }).limit(100),
        db.from("command_order_acknowledgments").select("command_order_id,acknowledged_at").eq("profile_id", profile.id),
        db.from("organizational_units").select("id,name").eq("active", true).eq("unit_type", "Division").order("name"),
      ]);
      const [roster, guardians, purview, notifications, certifications, training, requests, documents, announcements, points, leave, orders, orderAcknowledgments, divisions] = results.map(checked);
      return reply({ ok: true, snapshot: { profile, roster, guardians, purview, notifications, certifications, training, requests, documents, announcements, points, leave, orders, orderAcknowledgments, divisions, syncedAt: new Date().toISOString() } });
    }
    if (action === "guardian_save") {
      const recordType = text(body.recordType, 40), id = uuid(body.id), subjectId = uuid(body.subjectId);
      if (!kinds.includes(recordType)) throw new MobileError("Choose a Guardian type.");
      const title = text(body.title, 160), observed = text(body.observedBehavior, 10000);
      if (title.length < 4 || observed.length < 10) throw new MobileError("Add a title and a complete account of the incident.");
      const purview: any[] = checked(await db.rpc("get_personnel_in_my_purview")) ?? [];
      if (subjectId === profile.id || !purview.some(row => row.profile_id === subjectId)) throw new MobileError("This member is outside your supervisory purview.", 403);
      const points = recordType === "Commendation" ? 0 : Number(body.points ?? 0);
      if (!Number.isInteger(points) || points < 0 || points > 10) throw new MobileError("Points must be between 0 and 10.");
      const requiresReview = ["Written Warning", "Write-Up"].includes(recordType);
      const status = body.draft === true ? "Draft" : requiresReview ? "Pending Approval" : "Awaiting Acknowledgment";
      const payload = { subject_profile_id: subjectId, record_type: recordType, status, title,
        incident_at: date(body.incidentAt, true), location: text(body.location, 240), policy_reference: text(body.policyReference, 1000) || null,
        observed_behavior: observed, expected_standard: text(body.expectedStandard, 10000), action_taken: text(body.actionTaken, 10000),
        follow_up_plan: text(body.followUpPlan, 4000), follow_up_due_at: date(body.followUpDueAt), points_assessed: points,
        submitted_at: status === "Draft" ? null : new Date().toISOString(), issued_at: status === "Awaiting Acknowledgment" ? new Date().toISOString() : null,
        structured_fields: { source: "LSCSO Phone" } };
      const prior = checked<any>(await db.from("guardian_records").select("id,author_profile_id,status,guardian_number").eq("id", id).maybeSingle());
      if (prior) {
        if (prior.author_profile_id !== profile.id) throw new MobileError("Only the author can edit this draft.", 403);
        if (prior.status !== "Draft") return reply({ ok: true, record: prior, alreadySaved: true });
        // Direct issue transitions are guarded by the same database workflow used by the website.
        // Existing drafts use a dedicated authenticated RPC to preserve a single record and case number.
        const record = checked(await db.rpc("mobile_save_guardian_draft", { p_id: id, p_payload: payload }));
        return reply({ ok: true, record });
      }
      const result = await db.from("guardian_records").insert({ id, ...payload }).select("id,guardian_number,status").single();
      if (result.error?.code === "23505") {
        const record = checked<any>(await db.from("guardian_records").select("id,guardian_number,status,author_profile_id").eq("id", id).single());
        if (record.author_profile_id !== profile.id) throw new MobileError("This record cannot be edited.", 403);
        return reply({ ok: true, record, alreadySaved: true });
      }
      return reply({ ok: true, record: checked(result) });
    }
    if (action === "guardian_acknowledge") return reply({ ok: true, record: checked(await db.rpc("acknowledge_guardian", { record_id: uuid(body.id), signature_name: text(body.signature, 160), response_text: text(body.response, 4000) })) });
    if (action === "guardian_review") {
      if (!["Approved", "Denied"].includes(body.decision) || text(body.notes).length < 4) throw new MobileError("Enter a decision and review notes.");
      return reply({ ok: true, record: checked(await db.rpc("review_guardian", { record_id: uuid(body.id), decision: body.decision, review_notes: text(body.notes, 4000) })) });
    }
    if (action === "guardian_issue") return reply({ ok: true, record: checked(await db.rpc("issue_guardian", { record_id: uuid(body.id) })) });
    if (action === "order_acknowledge") return reply({ ok: true, acknowledgedAt: checked(await db.rpc("acknowledge_command_order", { p_order_id: uuid(body.id) })) });
    if (action === "notification_read") {
      checked(await db.from("notifications").update({ read_at: new Date().toISOString() }).eq("id", uuid(body.id)).eq("recipient_profile_id", profile.id));
      return reply({ ok: true });
    }
    if (action === "personnel_update") {
      if (text(body.reason).length < 4) throw new MobileError("Enter a reason for this personnel change.");
      return reply({ ok: true, record: checked(await db.rpc("roster_update_personnel_rank_status", { p_profile_id: uuid(body.id), p_rank: text(body.rank, 60), p_status: text(body.status, 40), p_reason: text(body.reason, 2000) })) });
    }
    if (action === "request_submit") {
      if (!["Promotion", "Division Transfer", "Certification", "Other"].includes(body.requestType) || text(body.details).length < 10) throw new MobileError("Choose a request type and explain your request.");
      const id = uuid(body.id);
      const existing = checked(await db.from("personnel_requests").select("id,request_number").eq("id", id).eq("requester_profile_id", profile.id).maybeSingle());
      if (existing) return reply({ ok: true, record: existing });
      const record = checked(await db.from("personnel_requests").insert({ id, requester_profile_id: profile.id, request_type: body.requestType, subject: text(body.subject, 160), details: text(body.details, 4000), requested_unit_id: body.requestType === "Division Transfer" ? uuid(body.unitId) : null, status: "Submitted" }).select("id,request_number,status").single());
      return reply({ ok: true, record });
    }
    if (action === "leave_submit") {
      if (!["Personal", "Medical", "Military", "Family", "Administrative", "Other"].includes(body.leaveType)) throw new MobileError("Choose a leave type.");
      const start = date(body.startsOn, true)!, end = date(body.returnOn, true)!;
      if (end < start) throw new MobileError("The return date must be on or after the start date.");
      const id = uuid(body.id);
      const existing = checked(await db.from("leave_requests").select("id,request_number").eq("id", id).eq("profile_id", profile.id).maybeSingle());
      if (existing) return reply({ ok: true, record: existing });
      const overlap = checked<any[]>(await db.from("leave_requests").select("id").eq("profile_id", profile.id).in("status", ["Submitted", "In Review", "Approved"]).lte("starts_on", end.slice(0,10)).gte("expected_return_on", start.slice(0,10)).limit(1));
      if (overlap.length) throw new MobileError("You already have a leave request covering these dates.", 409);
      return reply({ ok: true, record: checked(await db.from("leave_requests").insert({ id, profile_id: profile.id, leave_type: body.leaveType, starts_on: start.slice(0,10), expected_return_on: end.slice(0,10), notes: text(body.notes, 2000), status: "Submitted" }).select("id,request_number,status").single()) });
    }
    throw new MobileError("Unsupported app action.");
  } catch (error) { return fail(error); }
}
