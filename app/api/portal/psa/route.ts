import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getCurrentPortalProfile } from "@/lib/supabase/portal-profile";

const allowedTiers = new Set(["Executive", "Command"]);

function cleanMessage(value: unknown) {
  return typeof value === "string" ? value.trim().replace(/\s+/g, " ").slice(0, 240) : "";
}

async function authorize() {
  const profile = await getCurrentPortalProfile();
  return profile && allowedTiers.has(profile.access_tier) ? profile : null;
}

export async function GET() {
  const profile = await authorize();
  if (!profile) return NextResponse.json({ error: "You do not have permission to manage public PSAs." }, { status: 403 });

  const supabase = await createClient() as any;
  const { data, error } = await supabase
    .from("site_psa")
    .select("message,is_active,updated_at,updated_by_profile_id")
    .eq("id", "homepage")
    .maybeSingle();

  if (error) return NextResponse.json({ error: "The current PSA could not be loaded." }, { status: 500 });

  let updatedBy: { displayName: string; rank: string } | null = null;
  if (data?.updated_by_profile_id) {
    const { data: actor } = await supabase
      .from("personnel_profiles")
      .select("display_name,rank")
      .eq("id", data.updated_by_profile_id)
      .maybeSingle();
    if (actor) updatedBy = { displayName: actor.display_name, rank: actor.rank };
  }

  return NextResponse.json({
    message: data?.message ?? "",
    isActive: Boolean(data?.is_active),
    updatedAt: data?.updated_at ?? null,
    updatedBy,
  });
}

export async function PATCH(request: Request) {
  const profile = await authorize();
  if (!profile) return NextResponse.json({ error: "You do not have permission to manage public PSAs." }, { status: 403 });

  const supabase = await createClient() as any;

  try {
    const body = await request.json();
    const message = cleanMessage(body.message);
    const isActive = body.isActive === true;

    if (!message) return NextResponse.json({ error: "Enter a PSA message before saving." }, { status: 400 });

    const updatedAt = new Date().toISOString();
    const nextRecord = {
      id: "homepage",
      message,
      is_active: isActive,
      updated_by_profile_id: profile.id,
      updated_at: updatedAt,
    };

    const { error } = await supabase.from("site_psa").upsert(nextRecord, { onConflict: "id" });
    if (error) throw error;

    return NextResponse.json({
      success: true,
      message,
      isActive,
      updatedAt,
      updatedBy: { displayName: profile.display_name, rank: profile.rank },
    });
  } catch {
    return NextResponse.json({ error: "The public PSA could not be updated. Please try again." }, { status: 500 });
  }
}
