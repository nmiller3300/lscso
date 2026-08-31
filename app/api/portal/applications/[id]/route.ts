import { NextResponse } from "next/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { getCurrentPortalProfile } from "@/lib/supabase/portal-profile";
import { APPLICATION_STATUSES, INTERVIEW_STATUSES } from "@/lib/recruitment/application";

const allowedTiers = new Set(["Executive", "Command"]);
const statuses = new Set<string>(APPLICATION_STATUSES);
const interviewStatuses = new Set<string>(INTERVIEW_STATUSES);

function serviceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL, key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  return url && key ? createServiceClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } }) : null;
}
function clean(value: unknown, max = 8000) { return typeof value === "string" ? value.trim().slice(0, max) : ""; }

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const profile = await getCurrentPortalProfile();
  if (!profile || !allowedTiers.has(profile.access_tier)) return NextResponse.json({ error: "You do not have permission to perform this action." }, { status: 403 });
  const supabase = serviceClient();
  if (!supabase) return NextResponse.json({ error: "Application service is not configured." }, { status: 503 });
  const { id } = await params;
  try {
    const body = await request.json();
    const { data: application } = await supabase.from("recruitment_applications").select("id,status").eq("id", id).maybeSingle();
    if (!application) return NextResponse.json({ error: "Unable to load this application." }, { status: 404 });
    const action = clean(body.action, 40);
    let update: Record<string, unknown> = {};
    let eventType = "", details: Record<string, unknown> = {};
    if (action === "assign_reviewer") {
      const reviewerId = clean(body.reviewerProfileId, 100);
      if (!reviewerId) return NextResponse.json({ error: "Select a reviewer." }, { status: 400 });
      const { data: reviewer } = await supabase.from("personnel_profiles").select("id,access_tier,status,display_name").eq("id", reviewerId).maybeSingle();
      if (!reviewer || !allowedTiers.has(reviewer.access_tier) || !["Active", "Acting"].includes(reviewer.status)) return NextResponse.json({ error: "The selected reviewer is unavailable." }, { status: 400 });
      update = { reviewer_profile_id: reviewer.id }; eventType = "Reviewer Assigned"; details = { reviewer_profile_id: reviewer.id, reviewer: reviewer.display_name };
    } else if (action === "status") {
      const status = clean(body.status, 30);
      if (!statuses.has(status) || ["Accepted", "Denied"].includes(status)) return NextResponse.json({ error: "Use the documented decision controls for acceptance or denial." }, { status: 400 });
      update = { status }; eventType = "Status Changed"; details = { from: application.status, to: status };
    } else if (action === "decision") {
      const status = clean(body.status, 20);
      const reason = clean(body.reason);
      if (!["Accepted", "Denied"].includes(status)) return NextResponse.json({ error: "Invalid decision." }, { status: 400 });
      if (status === "Denied" && !reason) return NextResponse.json({ error: "A denial reason is required." }, { status: 400 });
      update = { status, decided_at: new Date().toISOString(), decided_by_profile_id: profile.id, decision_notes: reason || null };
      eventType = status; details = { from: application.status, reason: reason || null };
    } else if (action === "note") {
      const content = clean(body.content);
      if (!content) return NextResponse.json({ error: "Enter a note before saving." }, { status: 400 });
      const { error } = await supabase.from("recruitment_application_notes").insert({ application_id: id, author_profile_id: profile.id, content });
      if (error) throw error;
      eventType = "Note Added"; details = { preview: content.slice(0, 160) };
    } else if (action === "interview") {
      const interviewStatus = clean(body.interviewStatus, 30), interviewerProfileId = clean(body.interviewerProfileId, 100), scheduledAt = clean(body.scheduledAt, 50), notes = clean(body.notes), result = clean(body.result);
      if (!interviewStatuses.has(interviewStatus)) return NextResponse.json({ error: "Invalid interview status." }, { status: 400 });
      if (interviewerProfileId) {
        const { data: interviewer } = await supabase.from("personnel_profiles").select("id,access_tier,status").eq("id", interviewerProfileId).maybeSingle();
        if (!interviewer || !allowedTiers.has(interviewer.access_tier) || !["Active", "Acting"].includes(interviewer.status)) return NextResponse.json({ error: "The selected interviewer is unavailable." }, { status: 400 });
      }
      update = { interview_status: interviewStatus, interviewer_profile_id: interviewerProfileId || null, interview_scheduled_at: scheduledAt || null, interview_notes: notes || null, interview_result: result || null };
      eventType = "Interview Updated"; details = { status: interviewStatus, scheduled_at: scheduledAt || null };
    } else return NextResponse.json({ error: "Invalid application action." }, { status: 400 });

    if (Object.keys(update).length) { const { error } = await supabase.from("recruitment_applications").update(update).eq("id", id); if (error) throw error; }
    const { error: historyError } = await supabase.from("recruitment_application_history").insert({ application_id: id, actor_profile_id: profile.id, event_type: eventType, details });
    if (historyError) throw historyError;
    return NextResponse.json({ success: true });
  } catch { return NextResponse.json({ error: "The application could not be updated. Please try again." }, { status: 500 }); }
}
