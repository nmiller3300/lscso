import { NextResponse } from "next/server";
import { hasHiringAuthority } from "@/lib/authorization/hiring-authority";
import { createClient } from "@/lib/supabase/server";
import { getCurrentPortalProfile } from "@/lib/supabase/portal-profile";

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const profile = await getCurrentPortalProfile();
  if (!profile || !(await hasHiringAuthority(profile))) {
    return NextResponse.json({ error: "You do not have permission to complete a Forensics Specialist appointment." }, { status: 403 });
  }

  const { id } = await params;
  const supabase = await createClient() as any;

  try {
    const { data, error } = await supabase.rpc("record_forensics_specialist_hire_website_only", {
      p_application_id: id,
    });

    if (error) {
      const message = typeof error.message === "string" && error.message.trim()
        ? error.message
        : "The Forensics Specialist personnel record could not be created.";
      console.error("[Forensics Specialist Appointment]", error);
      return NextResponse.json({ error: message }, { status: 409 });
    }

    return NextResponse.json({ success: true, appointment: data });
  } catch (error) {
    console.error("[Forensics Specialist Appointment]", error);
    return NextResponse.json({ error: "The Forensics Specialist personnel record could not be created. Please try again." }, { status: 500 });
  }
}
