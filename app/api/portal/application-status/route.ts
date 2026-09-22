import { NextResponse } from "next/server";
import { hasHiringAuthority } from "@/lib/authorization/hiring-authority";
import { getCurrentPortalProfile } from "@/lib/supabase/portal-profile";
import { createClient } from "@/lib/supabase/server";
import { RECRUITMENT_STATUS_ID } from "@/lib/recruitment/status";
import { APPLICATION_TRACKS, type ApplicationTrack } from "@/lib/recruitment/application";

const allowedTracks = new Set<string>(APPLICATION_TRACKS);

export async function PATCH(request: Request) {
  const profile = await getCurrentPortalProfile();
  if (!profile || !(await hasHiringAuthority(profile))) {
    return NextResponse.json({ error: "You do not have permission to control recruitment applications." }, { status: 403 });
  }

  try {
    const body = await request.json();
    const track = typeof body?.track === "string" ? body.track.trim() as ApplicationTrack : "Sworn Personnel";
    if (!allowedTracks.has(track)) {
      return NextResponse.json({ error: "Choose a valid application role." }, { status: 400 });
    }
    if (typeof body?.isOpen !== "boolean") {
      return NextResponse.json({ error: "Choose whether applications should be open or closed." }, { status: 400 });
    }

    const supabase = await createClient() as any;
    const updatedAt = new Date().toISOString();
    const availability = track === "Department Attorney"
      ? { department_attorney_applications_open: body.isOpen }
      : { applications_open: body.isOpen };

    const { error } = await supabase.from("recruitment_settings").upsert({
      id: RECRUITMENT_STATUS_ID,
      ...availability,
      updated_by_profile_id: profile.id,
      updated_at: updatedAt,
    }, { onConflict: "id" });

    if (error) throw error;

    return NextResponse.json({
      success: true,
      track,
      isOpen: body.isOpen,
      updatedAt,
      updatedBy: `${profile.rank} ${profile.display_name}`,
    }, { headers: { "Cache-Control": "no-store, max-age=0" } });
  } catch {
    return NextResponse.json({ error: "Application availability could not be updated. Please try again." }, { status: 500 });
  }
}
