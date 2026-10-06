import { NextResponse } from "next/server";
import { authorizeFiveMIntegration } from "@/lib/integrations/fivem/auth";
import { isLscsoGrade, LSCSO_JOB_NAME } from "@/lib/integrations/fivem/ranks";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

function cleanString(value: unknown, maxLength: number) {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

function noStore(payload: unknown, status = 200) {
  return NextResponse.json(payload, { status, headers: { "Cache-Control": "no-store" } });
}

function normalizeMailboxPart(value: string) {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

function generatedEmail(displayName: string, rank: string) {
  if (rank === "Sheriff") return "sheriff@lscso.gov";
  if (rank === "Undersheriff") return "undersheriff@lscso.gov";

  const parts = displayName.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return null;
  const first = normalizeMailboxPart(parts[0]);
  const last = normalizeMailboxPart(parts[parts.length - 1]);
  if (!first || !last) return null;
  return `${first[0]}.${last}@lscso.gov`;
}

async function verifyCaller(request: Request, body: Record<string, unknown>) {
  const authorization = authorizeFiveMIntegration(request);
  if (!authorization.ok) {
    return { response: noStore({ ok: false, error: authorization.error }, authorization.status) };
  }

  const citizenId = cleanString(body.citizenId, 100);
  const license = cleanString(body.license, 160);
  const jobName = cleanString(body.jobName, 64).toLowerCase();
  const jobGrade = Number(body.jobGrade);

  if (!citizenId || !license) {
    return { response: noStore({ ok: false, code: "invalid_identity", error: "Citizen ID and license are required." }, 400) };
  }

  if (jobName !== LSCSO_JOB_NAME || !isLscsoGrade(jobGrade)) {
    return { response: noStore({ ok: false, code: "invalid_lscso_job", error: "Active LSCSO employment is required." }, 403) };
  }

  const admin = createAdminClient() as any;
  const { data: link, error: linkError } = await admin
    .from("fivem_identity_links")
    .select("personnel_profile_id,license_identifier,active")
    .eq("citizen_id", citizenId)
    .eq("active", true)
    .maybeSingle();

  if (linkError) throw linkError;
  if (!link) {
    return { response: noStore({ ok: false, code: "identity_not_linked", error: "This character is not linked to LSCSO Personnel." }, 404) };
  }
  if (link.license_identifier && link.license_identifier !== license) {
    return { response: noStore({ ok: false, code: "identity_mismatch", error: "The linked FiveM identity does not match this character." }, 403) };
  }

  const { data: profile, error: profileError } = await admin
    .from("personnel_profiles")
    .select("id,status")
    .eq("id", link.personnel_profile_id)
    .maybeSingle();

  if (profileError) throw profileError;
  if (!profile || !["Active", "Acting", "Reserve"].includes(profile.status)) {
    return { response: noStore({ ok: false, code: "profile_inactive", error: "This LSCSO personnel record is not active." }, 403) };
  }

  return { admin };
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  if (!body) return noStore({ ok: false, code: "invalid_request", error: "A JSON request body is required." }, 400);

  try {
    const verified = await verifyCaller(request, body);
    if (verified.response) return verified.response;
    const admin = verified.admin;

    const [{ data: profiles, error: profileError }, { data: links, error: linkError }] = await Promise.all([
      admin
        .from("personnel_profiles")
        .select("id,personnel_id,display_name,rank,call_sign,division,status,access_tier")
        .in("status", ["Active", "Acting", "Reserve"])
        .order("display_name"),
      admin
        .from("fivem_identity_links")
        .select("personnel_profile_id,citizen_id,active,last_seen_at")
        .eq("active", true),
    ]);

    if (profileError) throw profileError;
    if (linkError) throw linkError;

    const citizenByProfile = new Map(
      (links ?? []).map((row: any) => [String(row.personnel_profile_id), row]),
    );

    const directory = (profiles ?? []).map((profile: any) => {
      const link = citizenByProfile.get(String(profile.id)) as any;
      return {
        profileId: profile.id,
        personnelId: profile.personnel_id,
        displayName: profile.display_name,
        rank: profile.rank,
        callSign: profile.call_sign,
        division: profile.division,
        status: profile.status,
        accessTier: profile.access_tier,
        email: generatedEmail(profile.display_name, profile.rank),
        citizenId: link?.citizen_id ?? null,
        lastSeenAt: link?.last_seen_at ?? null,
      };
    });

    return noStore({ ok: true, directory, syncedAt: new Date().toISOString() });
  } catch (error) {
    console.error("[FiveM Directory] integration failure", error);
    return noStore({ ok: false, code: "backend_error", error: "LSCSO Department Directory could not be loaded." }, 500);
  }
}
