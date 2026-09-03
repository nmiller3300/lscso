import { NextResponse } from "next/server";
import { authorizeFiveMIntegration } from "@/lib/integrations/fivem/auth";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const authorization = authorizeFiveMIntegration(request);
  if (!authorization.ok) {
    return NextResponse.json(
      { ok: false, error: authorization.error },
      { status: authorization.status },
    );
  }

  try {
    const admin = createAdminClient();
    const { error } = await admin
      .from("personnel_profiles")
      .select("id", { head: true, count: "exact" });

    if (error) throw error;

    return NextResponse.json(
      {
        ok: true,
        service: "lscso-fivem-integration",
        database: "reachable",
        version: "phase-1",
        checkedAt: new Date().toISOString(),
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    return NextResponse.json(
      {
        ok: false,
        service: "lscso-fivem-integration",
        database: "unreachable",
        error: "Integration backend is unavailable.",
      },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
}
