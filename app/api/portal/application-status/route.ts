import { NextResponse } from "next/server";
import { getCurrentPortalProfile } from "@/lib/supabase/portal-profile";
import { createClient } from "@/lib/supabase/server";
import { RECRUITMENT_STATUS_ID } from "@/lib/recruitment/status";

const allowedTiers = new Set(["Executive", "Command"]);

export async function PATCH(request: Request) {
  const profile = await getCurrentPortalProfile();
  if (!profile || !allowedTiers.has(profile.access_tier)) {
    return NextResponse.json({ error: "You do not have permission to control recruitment applications." }, { status: 403 });
  }

  try {
    const body = await request.json();
    if (typeof body?.isOpen !== "boolean") {
      return NextResponse.json({ error: "Choose whether applications should be open or closed." }, { status: 400 });
    }

    const supabase = await createClient() as any;
    const updatedAt = new Date().toISOString();
    const { error } = await supabase.from("recruitment_settings").upsert({
      id: RECRUITMENT_STATUS_ID,
      applications_open: body.isOpen,
      updated_by_profile_id: profile.id,
      updated_at: updatedAt,
    }, { onConflict: "id" });

    if (error) throw error;

    return NextResponse.json({
      success: true,
      isOpen: body.isOpen,
      updatedAt,
      updatedBy: `${profile.rank} ${profile.display_name}`,
    }, { headers: { "Cache-Control": "no-store, max-age=0" } });
  } catch {
    return NextResponse.json({ error: "Application availability could not be updated. Please try again." }, { status: 500 });
  }
}
