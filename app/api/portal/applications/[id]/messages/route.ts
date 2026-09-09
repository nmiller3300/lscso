import { NextResponse } from "next/server";
import { getCurrentPortalProfile } from "@/lib/supabase/portal-profile";
import { createClient } from "@/lib/supabase/server";

const allowedTiers = new Set(["Executive", "Command"]);

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const profile = await getCurrentPortalProfile();
  if (!profile || !allowedTiers.has(profile.access_tier)) {
    return NextResponse.json({ error: "You do not have permission to send applicant messages." }, { status: 403 });
  }

  try {
    const { id } = await params;
    const body = await request.json();
    const content = typeof body.content === "string" ? body.content.trim() : "";

    if (!content) {
      return NextResponse.json({ error: "Enter a message before sending." }, { status: 400 });
    }
    if (content.length > 2000) {
      return NextResponse.json({ error: "Applicant messages may not exceed 2,000 characters." }, { status: 400 });
    }

    const supabase = await createClient() as any;
    const { data, error } = await supabase.rpc("send_recruitment_applicant_message", {
      p_application_id: id,
      p_content: content,
    });

    if (error) throw error;
    return NextResponse.json({ success: true, message_id: data });
  } catch (error) {
    console.error("[Recruitment Applicant Message]", error);
    return NextResponse.json({ error: "The applicant message could not be sent. Please try again." }, { status: 500 });
  }
}
