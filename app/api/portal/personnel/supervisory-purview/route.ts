import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getCurrentPortalProfile } from "@/lib/supabase/portal-profile";

const allowedTiers = new Set(["Executive", "Command"]);

function cleanId(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function cleanReason(value: unknown) {
  return typeof value === "string" ? value.trim().replace(/\s+/g, " ").slice(0, 500) : "";
}

export async function POST(request: Request) {
  const profile = await getCurrentPortalProfile();
  if (!profile || !allowedTiers.has(profile.access_tier)) {
    return NextResponse.json({ error: "Command authority is required to manage supervisory purview." }, { status: 403 });
  }

  try {
    const body = await request.json();
    const action = body?.action === "remove" ? "remove" : "assign";
    const subjectProfileId = cleanId(body?.subjectProfileId);
    const supervisorProfileId = cleanId(body?.supervisorProfileId);
    const reason = cleanReason(body?.reason);

    if (!subjectProfileId) {
      return NextResponse.json({ error: "Select a personnel member." }, { status: 400 });
    }
    if (reason.length < 4) {
      return NextResponse.json({ error: "Enter a short documented reason for this purview change." }, { status: 400 });
    }
    if (action === "assign" && !supervisorProfileId) {
      return NextResponse.json({ error: "Select a supervisor." }, { status: 400 });
    }

    const supabase = await createClient() as any;
    const result = action === "remove"
      ? await supabase.rpc("roster_remove_primary_supervisor", {
          p_subject_profile_id: subjectProfileId,
          p_reason: reason,
        })
      : await supabase.rpc("roster_assign_primary_supervisor", {
          p_subject_profile_id: subjectProfileId,
          p_supervisor_profile_id: supervisorProfileId,
          p_reason: reason,
        });

    if (result.error) {
      return NextResponse.json({ error: result.error.message || "The supervisory assignment could not be updated." }, { status: 400 });
    }

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "The supervisory assignment could not be updated. Please try again." }, { status: 500 });
  }
}
