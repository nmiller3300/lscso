import { NextResponse } from "next/server";
import { getCurrentPortalProfile } from "@/lib/supabase/portal-profile";
import { createClient } from "@/lib/supabase/server";

const allowedTiers = new Set(["Executive", "Command"]);

function errorStatus(message: string) {
  const normalized = message.toLowerCase();
  if (normalized.includes("permission")) return 403;
  if (normalized.includes("unable to load") || normalized.includes("not found")) return 404;
  return 500;
}

async function authorize() {
  const profile = await getCurrentPortalProfile();
  return profile && allowedTiers.has(profile.access_tier) ? profile : null;
}

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await authorize())) {
    return NextResponse.json({ error: "You do not have permission to view applicant tracking links." }, { status: 403 });
  }

  try {
    const { id } = await params;
    const supabase = await createClient() as any;
    const { data, error } = await supabase.rpc("get_recruitment_tracking_token", { p_application_id: id });

    if (error) {
      const message = error.message || "The tracking link could not be loaded.";
      const status = errorStatus(message);
      if (status >= 500) console.error("[Recruitment Tracking Link]", error);
      return NextResponse.json({ error: status >= 500 ? "The tracking link could not be loaded." : message }, { status });
    }

    return NextResponse.json({ available: Boolean(data), tracking_token: data || null }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("[Recruitment Tracking Link]", error);
    return NextResponse.json({ error: "The tracking link could not be loaded." }, { status: 500 });
  }
}

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await authorize())) {
    return NextResponse.json({ error: "You do not have permission to reissue applicant tracking links." }, { status: 403 });
  }

  try {
    const { id } = await params;
    const supabase = await createClient() as any;
    const { data, error } = await supabase.rpc("reissue_recruitment_tracking_token", { p_application_id: id });

    if (error || !data) {
      const message = error?.message || "The tracking link could not be reissued.";
      const status = errorStatus(message);
      if (status >= 500) console.error("[Recruitment Tracking Link Reissue]", error);
      return NextResponse.json({ error: status >= 500 ? "The tracking link could not be reissued." : message }, { status });
    }

    return NextResponse.json({ available: true, tracking_token: data }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("[Recruitment Tracking Link Reissue]", error);
    return NextResponse.json({ error: "The tracking link could not be reissued." }, { status: 500 });
  }
}
