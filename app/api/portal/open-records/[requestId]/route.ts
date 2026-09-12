import { NextResponse } from "next/server";
import { getCurrentPortalProfile } from "@/lib/supabase/portal-profile";
import { createClient } from "@/lib/supabase/server";

const allowedStatuses = new Set(["Submitted","Acknowledged","In Review","Awaiting Payment","Ready","Partially Granted","Denied","Completed","Closed"]);

function clean(value: unknown, max = 8000) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

export async function PATCH(request: Request, { params }: { params: Promise<{ requestId: string }> }) {
  const profile = await getCurrentPortalProfile();
  if (!profile || !["Executive", "Command"].includes(profile.access_tier)) {
    return NextResponse.json({ error: "Command authority required." }, { status: 403 });
  }

  const { requestId } = await params;
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return NextResponse.json({ error: "Invalid request update." }, { status: 400 });
  }

  const status = clean(body.status, 40);
  if (!allowedStatuses.has(status)) return NextResponse.json({ error: "Select a valid request status." }, { status: 400 });

  const supabase = await createClient() as any;
  const { data: current, error: currentError } = await supabase
    .from("open_records_requests")
    .select("id,status,acknowledged_at,completed_at")
    .eq("id", requestId)
    .maybeSingle();
  if (currentError || !current) return NextResponse.json({ error: "Open records request not found." }, { status: 404 });

  const now = new Date().toISOString();
  const update: Record<string, unknown> = {
    status,
    internal_notes: clean(body.internal_notes, 8000) || null,
    response_summary: clean(body.response_summary, 8000) || null,
    updated_at: now,
  };
  if (!current.acknowledged_at && status !== "Submitted") update.acknowledged_at = now;
  if (!current.completed_at && ["Completed", "Closed", "Denied"].includes(status)) update.completed_at = now;

  const { error } = await supabase.from("open_records_requests").update(update).eq("id", requestId);
  if (error) {
    console.error("Open records request update failed", error);
    return NextResponse.json({ error: "The request could not be updated." }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
