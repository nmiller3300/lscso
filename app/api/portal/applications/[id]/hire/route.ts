import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getCurrentPortalProfile } from "@/lib/supabase/portal-profile";

const ALLOWED_TIERS = new Set(["Executive", "Command"]);

function clean(value: unknown, max = 160) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const profile = await getCurrentPortalProfile();
  if (!profile || !ALLOWED_TIERS.has(profile.access_tier)) {
    return NextResponse.json({ error: "Only active Command Staff may complete a Recruit hire handoff." }, { status: 403 });
  }

  const { id } = await params;
  const supabase = await createClient() as any;

  try {
    const body = await request.json();
    const citizenId = clean(body.citizenId, 100);
    const licenseIdentifier = clean(body.licenseIdentifier, 180);
    const characterName = clean(body.characterName, 120);
    const rawServerId = body.serverId;
    const serverId = rawServerId === "" || rawServerId === null || rawServerId === undefined
      ? null
      : Number(rawServerId);

    if (!citizenId) {
      return NextResponse.json({ error: "FiveM citizen ID is required." }, { status: 400 });
    }
    if (serverId !== null && (!Number.isInteger(serverId) || serverId < 0)) {
      return NextResponse.json({ error: "Server ID must be a whole number." }, { status: 400 });
    }

    const { data, error } = await supabase.rpc("record_recruit_hire_from_portal", {
      p_application_id: id,
      p_target_citizen_id: citizenId,
      p_target_license_identifier: licenseIdentifier || null,
      p_target_name: characterName || null,
      p_target_server_id: serverId,
    });

    if (error) {
      console.error("[Recruit Hire Handoff]", error);
      const message = typeof error.message === "string" && error.message.trim()
        ? error.message
        : "The Recruit record could not be created.";
      return NextResponse.json({ error: message }, { status: 409 });
    }

    return NextResponse.json({ success: true, hire: data });
  } catch (error) {
    console.error("[Recruit Hire Handoff]", error);
    return NextResponse.json({ error: "The Recruit record could not be created. Please try again." }, { status: 500 });
  }
}
