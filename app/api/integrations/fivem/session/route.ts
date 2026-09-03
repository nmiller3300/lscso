import { NextResponse } from "next/server";
import { authorizeFiveMIntegration } from "@/lib/integrations/fivem/auth";
import {
  getComputerAccessBand,
  getLscsoRankForGrade,
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
  const jobName = cleanString(body?.jobName, 64).toLowerCase();
  const jobGrade = Number(body?.jobGrade);

  if (!citizenId || !license) {
    return NextResponse.json(
      { ok: false, code: "invalid_identity", error: "Citizen ID and license are required." },
      { status: 400 },
    );
  }

  if (jobName !== LSCSO_JOB_NAME || !isLscsoGrade(jobGrade)) {
    return NextResponse.json(
      { ok: false, code: "invalid_lscso_job", error: "Active LSCSO job access is required." },
      { status: 403 },
    );
  }

  const admin = createAdminClient() as any;

  try {
    const { data: link, error: linkError } = await admin
      .from("fivem_identity_links")
      .select("id,personnel_profile_id,license_identifier,active")
      .eq("citizen_id", citizenId)
      .eq("active", true)
      .maybeSingle();

    if (linkError) throw linkError;
    if (!link) {
      return NextResponse.json(
        {
          ok: false,
          code: "identity_not_linked",
          error: "This FiveM character is not linked to an LSCSO personnel record.",
        },
        { status: 404 },
      );
    }

    if (link.license_identifier && link.license_identifier !== license) {
      return NextResponse.json(
        {
          ok: false,
          code: "identity_mismatch",
          error: "The linked FiveM identity does not match this character license.",
        },
        { status: 403 },
      );
    }

    const { data: profile, error: profileError } = await admin
      .from("personnel_profiles")
      .select("id,personnel_id,display_name,greeting_name,rank,call_sign,division,status,is_test_account")
      .eq("id", link.personnel_profile_id)
      .maybeSingle();

    if (profileError) throw profileError;
    if (!profile) {
      return NextResponse.json(
        { ok: false, code: "profile_missing", error: "Linked LSCSO personnel record was not found." },
        { status: 404 },
      );
    }

    if (!["Active", "Acting"].includes(profile.status)) {
      return NextResponse.json(
        {
          ok: false,
          code: "profile_inactive",
          error: "This LSCSO personnel record is not active.",
        },
        { status: 403 },
      );
    }

    const expectedRank = getLscsoRankForGrade(jobGrade);
    const now = new Date().toISOString();

    const linkUpdate: Record<string, unknown> = {
      last_seen_at: now,
      last_seen_grade: jobGrade,
      updated_at: now,
    };
    if (!link.license_identifier) linkUpdate.license_identifier = license;

    const { error: updateError } = await admin
      .from("fivem_identity_links")
      .update(linkUpdate)
      .eq("id", link.id);

    if (updateError) throw updateError;

    return NextResponse.json(
      {
        ok: true,
        session: {
          profileId: profile.id,
          personnelId: profile.personnel_id,
          displayName: profile.display_name,
          greetingName: profile.greeting_name,
          personnelRank: profile.rank,
          callSign: profile.call_sign,
          division: profile.division,
          status: profile.status,
          isTestAccount: profile.is_test_account,
          job: {
            name: LSCSO_JOB_NAME,
            grade: jobGrade,
            rank: expectedRank,
            accessBand: getComputerAccessBand(jobGrade),
          },
          rankMatchesFramework: profile.rank === expectedRank,
        },
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    return NextResponse.json(
      { ok: false, code: "backend_error", error: "LSCSO integration request failed." },
      { status: 500, headers: { "Cache-Control": "no-store" } },
    );
  }
}
