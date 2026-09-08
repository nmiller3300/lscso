import { NextResponse } from "next/server";
import { authorizeFiveMIntegration } from "@/lib/integrations/fivem/auth";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

function cleanString(value: unknown, maxLength: number) {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

function noStoreJson(payload: unknown, status = 200) {
  return NextResponse.json(payload, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

export async function POST(request: Request) {
  const authorization = authorizeFiveMIntegration(request);
  if (!authorization.ok) {
    return noStoreJson({ ok: false, error: authorization.error }, authorization.status);
  }

  const admin = createAdminClient() as any;
  if (!admin) return noStoreJson({ ok: false, error: "Personnel sync service is unavailable." }, 503);

  try {
    const body = await request.json().catch(() => null) as Record<string, unknown> | null;
    if (!body) return noStoreJson({ ok: false, error: "Invalid personnel sync request." }, 400);

    const action = cleanString(body.action, 24);
    if (action === "poll") {
      const now = new Date().toISOString();
      const { data, error } = await admin
        .from("fivem_personnel_sync_actions")
        .select("id,personnel_profile_id,citizen_id,desired_rank,desired_grade,desired_status,reason,attempts,created_at")
        .is("completed_at", null)
        .lte("next_attempt_at", now)
        .order("created_at", { ascending: true })
        .limit(25);
      if (error) throw error;

      return noStoreJson({
        ok: true,
        actions: (data ?? []).map((row: any) => ({
          id: row.id,
          personnelProfileId: row.personnel_profile_id,
          citizenId: row.citizen_id,
          desiredRank: row.desired_rank,
          desiredGrade: Number(row.desired_grade),
          desiredStatus: row.desired_status,
          reason: row.reason ?? null,
          attempts: Number(row.attempts ?? 0),
          createdAt: row.created_at,
        })),
      });
    }

    if (action === "ack") {
      const actionId = cleanString(body.actionId, 100);
      const success = body.success === true;
      const errorMessage = cleanString(body.error, 1000);
      if (!actionId) return noStoreJson({ ok: false, error: "Personnel sync action ID is required." }, 400);

      const { data: current, error: readError } = await admin
        .from("fivem_personnel_sync_actions")
        .select("id,attempts,completed_at")
        .eq("id", actionId)
        .maybeSingle();
      if (readError) throw readError;
      if (!current) return noStoreJson({ ok: false, error: "Personnel sync action was not found." }, 404);
      if (current.completed_at) return noStoreJson({ ok: true, alreadyCompleted: true });

      const attempts = Number(current.attempts ?? 0) + 1;
      const now = new Date();
      const update: Record<string, unknown> = {
        attempts,
        last_attempt_at: now.toISOString(),
      };

      if (success) {
        update.completed_at = now.toISOString();
        update.last_error = null;
      } else {
        const backoffSeconds = Math.min(300, Math.max(15, attempts * 15));
        update.next_attempt_at = new Date(now.getTime() + backoffSeconds * 1000).toISOString();
        update.last_error = errorMessage || "QBox personnel synchronization failed.";
      }

      const { error: updateError } = await admin
        .from("fivem_personnel_sync_actions")
        .update(update)
        .eq("id", actionId);
      if (updateError) throw updateError;

      return noStoreJson({ ok: true, attempts });
    }

    return noStoreJson({ ok: false, error: "Invalid personnel sync action." }, 400);
  } catch (error) {
    console.error("[FiveM Personnel Sync]", error);
    return noStoreJson({ ok: false, error: "Personnel synchronization could not complete this request." }, 500);
  }
}
