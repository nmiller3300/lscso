import { NextResponse } from "next/server";
import { getCurrentPortalProfile } from "@/lib/supabase/portal-profile";
import { createClient } from "@/lib/supabase/server";

const DELETE_RANKS = new Set(["Sheriff", "Undersheriff"]);

function clean(value: unknown, max = 40) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function applicationLabel(number: number | string) {
  return `APP-${String(number).padStart(4, "0")}`;
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const profile = await getCurrentPortalProfile();
  if (!profile || !DELETE_RANKS.has(profile.rank)) {
    return NextResponse.json({ error: "Only the Sheriff or Undersheriff may delete an application." }, { status: 403 });
  }

  const { id } = await params;
  const supabase = await createClient() as any;

  try {
    const { data: application, error: loadError } = await supabase
      .from("recruitment_applications")
      .select("id,application_number,status,hired_profile_id")
      .eq("id", id)
      .maybeSingle();

    if (loadError) throw loadError;
    if (!application) return NextResponse.json({ error: "Application not found." }, { status: 404 });
    if (application.hired_profile_id || application.status === "Hired") {
      return NextResponse.json({ error: "An application that has already created a Recruit record cannot be deleted." }, { status: 409 });
    }

    const body = await request.json().catch(() => ({}));
    const expected = applicationLabel(application.application_number);
    const confirmation = clean(body?.confirm, 40).toUpperCase();
    if (confirmation !== expected.toUpperCase()) {
      return NextResponse.json({ error: `Type ${expected} exactly to confirm deletion.` }, { status: 400 });
    }

    const { data: deleted, error: deleteError } = await supabase
      .from("recruitment_applications")
      .delete()
      .eq("id", id)
      .is("hired_profile_id", null)
      .select("id")
      .maybeSingle();

    if (deleteError) throw deleteError;
    if (!deleted) {
      return NextResponse.json({ error: "The application could not be deleted. It may no longer be eligible for deletion." }, { status: 409 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[Recruitment Application Delete]", error);
    return NextResponse.json({ error: "The application could not be deleted. Please try again." }, { status: 500 });
  }
}
