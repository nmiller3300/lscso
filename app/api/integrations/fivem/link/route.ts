import { NextResponse } from "next/server";
import { authorizeFiveMIntegration } from "@/lib/integrations/fivem/auth";
import {
  isLscsoGrade,
  LSCSO_JOB_NAME,
} from "@/lib/integrations/fivem/ranks";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

function cleanString(value: unknown, maxLength: number) {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

export async function POST(request: Request) {
  const authorization = authorizeFiveMIntegration(request);
  if (!authorization.ok) {
    return NextResponse.json(
      { ok: false, error: authorization.error },
      { status: authorization.status },
    );
  }

  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  const citizenId = cleanString(body?.citizenId, 100);
  const license = cleanString(body?.license, 160);
  const personnelId = cleanString(body?.personnelId, 16).toUpperCase();
  const jobName = cleanString(body?.jobName, 64).toLowerCase();
  const jobGrade = Number(body?.jobGrade);

  if (!citizenId || !license || !personnelId) {
    return NextResponse.json(
      {
        ok: false,
        code: "invalid_link_request",
        error: "Citizen ID, license, and personnel ID are required.",
      },
      { status: 400 },
    );
  }

  if (!/^LS-[0-9]{3}$/.test(personnelId)) {
    return NextResponse.json(
      {
        ok: false,
        code: "invalid_personnel_id",
        error: "Personnel ID must use the LS-### format.",
      },
      { status: 400 },
    );
  }

  if (jobName !== LSCSO_JOB_NAME || !isLscsoGrade(jobGrade)) {
    return NextResponse.json(
      {
        ok: false,
        code: "invalid_lscso_job",
        error: "The character must currently hold a valid LSCSO job grade.",
      },
      { status: 403 },
    );
  }

  const admin = createAdminClient() as any;

  try {
    const { data: profile, error: profileError } = await admin
      .from("personnel_profiles")
      .select("id,personnel_id,display_name,rank,status")
      .eq("personnel_id", personnelId)
      .maybeSingle();

    if (profileError) throw profileError;
    if (!profile) {
      return NextResponse.json(
        {
          ok: false,
          code: "profile_missing",
          error: "No LSCSO personnel record matches that personnel ID.",
        },
        { status: 404 },
      );
    }

    if (!["Active", "Acting"].includes(profile.status)) {
      return NextResponse.json(
        {
          ok: false,
          code: "profile_inactive",
          error: "That LSCSO personnel record is not active.",
        },
        { status: 409 },
      );
    }

    const { data: citizenLink, error: citizenLinkError } = await admin
      .from("fivem_identity_links")
      .select("id,personnel_profile_id,citizen_id,license_identifier,active")
      .eq("citizen_id", citizenId)
      .eq("active", true)
      .maybeSingle();

    if (citizenLinkError) throw citizenLinkError;

    if (citizenLink && citizenLink.personnel_profile_id !== profile.id) {
      return NextResponse.json(
        {
          ok: false,
          code: "citizen_already_linked",
          error: "This FiveM character is already linked to a different personnel record.",
        },
        { status: 409 },
      );
    }

    const { data: profileLinks, error: profileLinkError } = await admin
      .from("fivem_identity_links")
      .select("id,personnel_profile_id,citizen_id,license_identifier,active")
      .eq("personnel_profile_id", profile.id)
      .eq("active", true);

    if (profileLinkError) throw profileLinkError;

    const conflictingProfileLink = (profileLinks ?? []).find(
      (link: { citizen_id: string }) => link.citizen_id !== citizenId,
    );

    if (conflictingProfileLink) {
      return NextResponse.json(
        {
          ok: false,
          code: "profile_already_linked",
          error: "That personnel record is already linked to another active FiveM character.",
        },
        { status: 409 },
      );
    }

    const now = new Date().toISOString();

    if (citizenLink) {
      const { error: updateError } = await admin
        .from("fivem_identity_links")
        .update({
          license_identifier: license,
          last_seen_at: now,
          last_seen_grade: jobGrade,
          updated_at: now,
        })
        .eq("id", citizenLink.id);

      if (updateError) throw updateError;
    } else {
      const { error: insertError } = await admin
        .from("fivem_identity_links")
        .insert({
          personnel_profile_id: profile.id,
          citizen_id: citizenId,
          license_identifier: license,
          active: true,
          last_seen_at: now,
          last_seen_grade: jobGrade,
          updated_at: now,
        });

      if (insertError) throw insertError;
    }

    return NextResponse.json(
      {
        ok: true,
        link: {
          personnelId: profile.personnel_id,
          displayName: profile.display_name,
          personnelRank: profile.rank,
          citizenId,
          jobGrade,
        },
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    return NextResponse.json(
      {
        ok: false,
        code: "backend_error",
        error: "LSCSO identity link request failed.",
      },
      { status: 500, headers: { "Cache-Control": "no-store" } },
    );
  }
}
