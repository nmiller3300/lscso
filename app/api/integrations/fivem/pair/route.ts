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
  const code = cleanString(body?.code, 32);
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
    const { data: link, error } = await admin.rpc("mobile_redeem_pairing", {
      p_code_hash: await hashPairingCode(code), p_citizen_id: citizenId,
      p_license: license, p_grade: jobGrade,
    });
    if (error) return NextResponse.json({ ok: false, code: "pairing_failed", error: error.message }, { status: 409, headers: { "Cache-Control": "no-store" } });
    return NextResponse.json({ ok: true, link }, { headers: { "Cache-Control": "no-store" } });

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
