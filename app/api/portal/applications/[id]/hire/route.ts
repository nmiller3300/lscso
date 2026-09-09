import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getCurrentPortalProfile } from "@/lib/supabase/portal-profile";

const ALLOWED_TIERS = new Set(["Executive", "Command"]);

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const profile = await getCurrentPortalProfile();
  if (!profile || !ALLOWED_TIERS.has(profile.access_tier)) {
    return NextResponse.json({ error: "Only active Command Staff may complete a Recruit appointment." }, { status: 403 });
  }

  const { id } = await params;
  const supabase = await createClient() as any;

  try {
    const { data, error } = await supabase.rpc("record_recruit_hire_website_only", {
      p_application_id: id,
    });

    if (error) {
      console.error("[Recruit Appointment]", error);
      const message = typeof error.message === "string" && error.message.trim()
        ? error.message
        : "The Recruit personnel record could not be created.";
      return NextResponse.json({ error: message }, { status: 409 });
    }

    return NextResponse.json({ success: true, hire: data });
  } catch (error) {
    console.error("[Recruit Appointment]", error);
    return NextResponse.json({ error: "The Recruit personnel record could not be created. Please try again." }, { status: 500 });
  }
}
