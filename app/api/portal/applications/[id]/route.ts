import { NextResponse } from "next/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { getCurrentPortalProfile } from "@/lib/supabase/portal-profile";
import { APPLICATION_REVIEW_STATUSES, INTERVIEW_STATUSES } from "@/lib/recruitment/application";

const allowedTiers = new Set(["Executive", "Command"]);
const reviewStatuses = new Set<string>(APPLICATION_REVIEW_STATUSES);
const interviewStatuses = new Set<string>(INTERVIEW_STATUSES);
const finalizedApplicationStatuses = new Set(["Accepted", "Denied", "Hired", "Withdrawn"]);

function serviceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  return url && key ? createServiceClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } }) : null;
}

function clean(value: unknown, max = 8000) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const profile = await getCurrentPortalProfile();
  if (!profile || !allowedTiers.has(profile.access_tier)) {
    return NextResponse.json({ error: "You do not have permission to perform this action." }, { status: 403 });
  }

  const supabase = serviceClient();
  if (!supabase) return NextResponse.json({ error: "Application service is not configured." }, { status: 503 });

  const { id } = await params;

  try {
    const body = await request.json();
    const { data: application } = await supabase
      .from("recruitment_applications")
      .select("id,status,interview_status,hired_profile_id")
      .eq("id", id)
      .maybeSingle();

    if (!application) return NextResponse.json({ error: "Unable to load this application." }, { status: 404 });

    const action = clean(body.action, 40);
    let update: Record<string, unknown> = {};
    let eventType = "";
    let details: Record<string, unknown> = {};

    if (action === "assign_reviewer") {
      if (finalizedApplicationStatuses.has(application.status)) {
        return NextResponse.json({ error: "A finalized application cannot be reassigned." }, { status: 409 });
      }
      const reviewerId = clean(body.reviewerProfileId, 100);
      if (!reviewerId) return NextResponse.json({ error: "Select a reviewer." }, { status: 400 });
      const { data: reviewer } = await supabase
        .from("personnel_profiles")
        .select("id,access_tier,status,display_name")
        .eq("id", reviewerId)
        .maybeSingle();
      if (!reviewer || !allowedTiers.has(reviewer.access_tier) || !["Active", "Acting"].includes(reviewer.status)) {
        return NextResponse.json({ error: "The selected reviewer is unavailable." }, { status: 400 });
      }
      update = { reviewer_profile_id: reviewer.id };
      eventType = "Reviewer Assigned";
      details = { reviewer_profile_id: reviewer.id, reviewer: reviewer.display_name };
    } else if (action === "status") {
      if (finalizedApplicationStatuses.has(application.status)) {
        return NextResponse.json({ error: "The application decision has already been recorded." }, { status: 409 });
      }
      const status = clean(body.status, 30);
      if (!reviewStatuses.has(status)) {
        return NextResponse.json({ error: "Only Submitted and Under Review are valid screening stages. Use Accept Application or Deny with reason to record the application decision." }, { status: 400 });
      }
      update = { status };
      eventType = "Status Changed";
      details = { from: application.status, to: status };
    } else if (action === "decision") {
      if (finalizedApplicationStatuses.has(application.status)) {
        return NextResponse.json({ error: "This application already has a recorded application decision." }, { status: 409 });
      }
      if (!reviewStatuses.has(application.status)) {
        return NextResponse.json({ error: "Move the application into the Command review workflow before recording a decision." }, { status: 409 });
      }

      const status = clean(body.status, 20);
      const reason = clean(body.reason);
      if (!["Accepted", "Denied"].includes(status)) {
        return NextResponse.json({ error: "Invalid application decision." }, { status: 400 });
      }
      if (status === "Denied" && reason.length < 4) {
        return NextResponse.json({ error: "A denial reason of at least 4 characters is required." }, { status: 400 });
      }

      update = {
        status,
        decided_at: new Date().toISOString(),
        decided_by_profile_id: profile.id,
        decision_notes: status === "Denied" ? reason : null,
      };
      eventType = status;
      details = status === "Denied"
        ? { from: application.status, reason }
        : { from: application.status, next_step: "Required interview" };
    } else if (action === "note") {
      const content = clean(body.content);
      if (!content) return NextResponse.json({ error: "Enter a note before saving." }, { status: 400 });
      const { error } = await supabase.from("recruitment_application_notes").insert({
        application_id: id,
        author_profile_id: profile.id,
        content,
      });
      if (error) throw error;
      eventType = "Note Added";
      details = { preview: content.slice(0, 160) };
    } else if (action === "interview") {
      if (application.status !== "Accepted") {
        return NextResponse.json({ error: "The application must be accepted before an interview can be scheduled or recorded." }, { status: 409 });
      }
      if (application.hired_profile_id) {
        return NextResponse.json({ error: "This applicant has already been hired as a Recruit." }, { status: 409 });
      }

      const interviewStatus = clean(body.interviewStatus, 30);
      const interviewerProfileId = clean(body.interviewerProfileId, 100);
      const scheduledAt = clean(body.scheduledAt, 50);
      const notes = clean(body.notes);
      const result = clean(body.result);

      if (!interviewStatuses.has(interviewStatus)) {
        return NextResponse.json({ error: "Invalid interview status." }, { status: 400 });
      }
      if (interviewStatus === "Scheduled" && !scheduledAt) {
        return NextResponse.json({ error: "Enter the scheduled interview date and time." }, { status: 400 });
      }
      if (["Passed", "Failed"].includes(interviewStatus) && result.length < 3) {
        return NextResponse.json({ error: "Document the interview result before recording Pass or Fail." }, { status: 400 });
      }

      if (interviewerProfileId) {
        const { data: interviewer } = await supabase
          .from("personnel_profiles")
          .select("id,access_tier,status")
          .eq("id", interviewerProfileId)
          .maybeSingle();
        if (!interviewer || !allowedTiers.has(interviewer.access_tier) || !["Active", "Acting"].includes(interviewer.status)) {
          return NextResponse.json({ error: "The selected interviewer is unavailable." }, { status: 400 });
        }
      }

      update = {
        interview_status: interviewStatus,
        interviewer_profile_id: interviewerProfileId || null,
        interview_scheduled_at: scheduledAt || null,
        interview_notes: notes || null,
        interview_result: result || null,
      };
      eventType = "Interview Updated";
      details = { status: interviewStatus, scheduled_at: scheduledAt || null, result: result || null };
    } else {
      return NextResponse.json({ error: "Invalid application action." }, { status: 400 });
    }

    if (Object.keys(update).length) {
      const { error } = await supabase.from("recruitment_applications").update(update).eq("id", id);
      if (error) throw error;
    }

    const { error: historyError } = await supabase.from("recruitment_application_history").insert({
      application_id: id,
      actor_profile_id: profile.id,
      event_type: eventType,
      details,
    });
    if (historyError) throw historyError;

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[Recruitment Application Update]", error);
    return NextResponse.json({ error: "The application could not be updated. Please try again." }, { status: 500 });
  }
}
