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

async function hashPairingCode(code: string) {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(code),
  );
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
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
  const code = cleanString(body?.code, 6);
  const citizenId = cleanString(body?.citizenId, 100);
  const license = cleanString(body?.license, 160);
  const jobName = cleanString(body?.jobName, 64).toLowerCase();
  const jobGrade = Number(body?.jobGrade);

  if (!/^[0-9]{6}$/.test(code) || !citizenId || !license) {
    return NextResponse.json(
      {
        ok: false,
        code: "invalid_pairing_request",
        error: "A valid 6-digit pairing code and FiveM identity are required.",
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
    const codeHash = await hashPairingCode(code);
    const now = new Date().toISOString();

    const { data: pairing, error: pairingError } = await admin
      .from("fivem_pairing_codes")
      .select("id,personnel_profile_id,expires_at,consumed_at")
      .eq("code_hash", codeHash)
      .is("consumed_at", null)
      .gt("expires_at", now)
      .maybeSingle();

    if (pairingError) throw pairingError;
    if (!pairing) {
      return NextResponse.json(
        {
          ok: false,
          code: "pairing_code_invalid",
          error: "That pairing code is invalid or has expired.",
        },
        { status: 404 },
      );
    }

    const { data: profile, error: profileError } = await admin
      .from("personnel_profiles")
      .select("id,personnel_id,display_name,rank,status")
      .eq("id", pairing.personnel_profile_id)
      .maybeSingle();

    if (profileError) throw profileError;
    if (!profile || !["Active", "Acting"].includes(profile.status)) {
      return NextResponse.json(
        {
          ok: false,
          code: "profile_inactive",
          error: "The personnel account for this pairing code is not active.",
        },
        { status: 409 },
      );
    }

    const { data: citizenLink, error: citizenLinkError } = await admin
      .from("fivem_identity_links")
      .select("id,personnel_profile_id,citizen_id")
      .eq("citizen_id", citizenId)
      .eq("active", true)
      .maybeSingle();

    if (citizenLinkError) throw citizenLinkError;

    if (citizenLink && citizenLink.personnel_profile_id !== profile.id) {
      return NextResponse.json(
        {
          ok: false,
          code: "citizen_already_linked",
          error: "This FiveM character is already linked to another LSCSO account.",
        },
        { status: 409 },
      );
    }

    const { data: profileLink, error: profileLinkError } = await admin
      .from("fivem_identity_links")
      .select("id,citizen_id")
      .eq("personnel_profile_id", profile.id)
      .eq("active", true)
      .maybeSingle();

    if (profileLinkError) throw profileLinkError;

    if (profileLink && profileLink.citizen_id !== citizenId) {
      return NextResponse.json(
        {
          ok: false,
          code: "profile_already_linked",
          error: "This LSCSO account is already linked to another FiveM character.",
        },
        { status: 409 },
      );
    }

    if (citizenLink || profileLink) {
      const linkId = citizenLink?.id ?? profileLink?.id;
      if (!linkId) throw new Error("Linked FiveM identity could not be resolved.");
      const { error: updateError } = await admin
        .from("fivem_identity_links")
        .update({
          license_identifier: license,
          last_seen_at: now,
          last_seen_grade: jobGrade,
          updated_at: now,
        })
        .eq("id", linkId);

      if (updateError) throw updateError;
    } else {
      const { error: insertError } = await admin
        .from("fivem_identity_links")
        .insert({
          personnel_profile_id: profile.id,
          citizen_id: citizenId,
          license_identifier: license,
          active: true,
          linked_by: profile.id,
          last_seen_at: now,
          last_seen_grade: jobGrade,
          updated_at: now,
        });

      if (insertError) throw insertError;
    }

    const { error: consumeError } = await admin
      .from("fivem_pairing_codes")
      .update({ consumed_at: now })
      .eq("id", pairing.id)
      .is("consumed_at", null);

    if (consumeError) throw consumeError;

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
        error: "LSCSO FiveM pairing failed.",
      },
      { status: 500, headers: { "Cache-Control": "no-store" } },
    );
  }
}
