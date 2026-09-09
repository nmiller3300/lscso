import { NextResponse } from "next/server";
import { getCurrentPortalProfile } from "@/lib/supabase/portal-profile";
import { createClient } from "@/lib/supabase/server";

const allowedTiers = new Set(["Executive", "Command"]);

function clean(value: unknown, max = 40) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function actionErrorStatus(message: string) {
  const normalized = message.toLowerCase();
  if (normalized.includes("permission") || normalized.includes("command staff")) return 403;
  if (normalized.includes("unable to load") || normalized.includes("not found")) return 404;
  if (
    normalized.includes("already") ||
    normalized.includes("finalized") ||
    normalized.includes("must be accepted") ||
    normalized.includes("before recording a decision") ||
    normalized.includes("hired as a recruit")
  ) return 409;
  if (
    normalized.includes("invalid") ||
    normalized.includes("select ") ||
    normalized.includes("enter ") ||
    normalized.includes("required") ||
    normalized.includes("cannot exceed") ||
    normalized.includes("only submitted")
  ) return 400;
  return 500;
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const profile = await getCurrentPortalProfile();
  if (!profile || !allowedTiers.has(profile.access_tier)) {
    return NextResponse.json({ error: "You do not have permission to perform this action." }, { status: 403 });
  }

  try {
    const { id } = await params;
    const body = await request.json();
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return NextResponse.json({ error: "Invalid application action." }, { status: 400 });
    }

    const action = clean((body as Record<string, unknown>).action);
    if (!action) {
      return NextResponse.json({ error: "Invalid application action." }, { status: 400 });
    }

    const supabase = await createClient() as any;
    const { data, error } = await supabase.rpc("command_recruitment_application_action", {
      p_application_id: id,
      p_action: action,
      p_payload: body,
    });

    if (error) {
      const message = typeof error.message === "string" && error.message.trim()
        ? error.message
        : "The application could not be updated.";
      const status = actionErrorStatus(message);
      if (status >= 500) console.error("[Recruitment Application Update]", error);
      return NextResponse.json(
        { error: status >= 500 ? "The application could not be updated. Please try again." : message },
        { status },
      );
    }

    return NextResponse.json({ success: true, changed: data?.changed !== false });
  } catch (error) {
    console.error("[Recruitment Application Update]", error);
    return NextResponse.json({ error: "The application could not be updated. Please try again." }, { status: 500 });
  }
}
