import { NextResponse } from "next/server";
import { hasHiringAuthority } from "@/lib/authorization/hiring-authority";
import { getCurrentPortalProfile } from "@/lib/supabase/portal-profile";
import { createClient } from "@/lib/supabase/server";

function clean(value: unknown, max = 40) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function actionErrorStatus(message: string) {
  const normalized = message.toLowerCase();
  if (normalized.includes("permission")) return 403;
  if (normalized.includes("unable to load") || normalized.includes("not found")) return 404;
  if (normalized.includes("already") || normalized.includes("finalized") || normalized.includes("only a case closed")) return 409;
  if (
    normalized.includes("invalid") ||
    normalized.includes("select ") ||
    normalized.includes("enter ") ||
    normalized.includes("required") ||
    normalized.includes("only ") ||
    normalized.includes("cannot exceed") ||
    normalized.includes("must be")
  ) return 400;
  return 500;
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const profile = await getCurrentPortalProfile();
  if (!profile || !(await hasHiringAuthority(profile))) {
    return NextResponse.json({ error: "You do not have permission to perform this action." }, { status: 403 });
  }

  try {
    const { id } = await params;
    const body = await request.json();
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return NextResponse.json({ error: "Invalid Department Attorney application action." }, { status: 400 });
    }

    const action = clean((body as Record<string, unknown>).action);
    if (!action) {
      return NextResponse.json({ error: "Invalid Department Attorney application action." }, { status: 400 });
    }

    const supabase = await createClient() as any;
    const result = action === "appoint"
      ? await supabase.rpc("record_department_attorney_hire_website_only", { p_application_id: id })
      : action === "reopen_no_show"
        ? await supabase.rpc("command_reopen_recruitment_no_show", { p_application_id: id })
        : await supabase.rpc("command_department_attorney_application_action", {
            p_application_id: id,
            p_action: action,
            p_payload: body,
          });

    const { data, error } = result;
    if (error) {
      const message = typeof error.message === "string" && error.message.trim()
        ? error.message
        : "The Department Attorney application could not be updated.";
      const status = actionErrorStatus(message);
      if (status >= 500) console.error("[Department Attorney Application Update]", error);
      return NextResponse.json(
        { error: status >= 500 ? "The Department Attorney application could not be updated. Please try again." : message },
        { status },
      );
    }

    return NextResponse.json({ success: true, changed: data?.changed !== false, result: data ?? null });
  } catch (error) {
    console.error("[Department Attorney Application Update]", error);
    return NextResponse.json({ error: "The Department Attorney application could not be updated. Please try again." }, { status: 500 });
  }
}
