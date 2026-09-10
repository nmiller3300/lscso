import { createHash, randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { APPLICATION_AI_POLICY_TEXT, APPLICATION_CERTIFICATION_TEXT } from "@/lib/recruitment/application";

function clean(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function rpcErrorStatus(message: string) {
  const normalized = message.toLowerCase();
  if (normalized.includes("currently closed")) return 403;
  if (normalized.includes("already submitted in the last 24 hours")) return 409;
  if (
    normalized.includes("please ") ||
    normalized.includes("required") ||
    normalized.includes("select yes or no") ||
    normalized.includes("select a valid answer") ||
    normalized.includes("certification is invalid") ||
    normalized.includes("ai use policy") ||
    normalized.includes("cannot exceed") ||
    normalized.includes("tracking token is invalid")
  ) return 400;
  return 500;
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return NextResponse.json({ error: "Invalid application." }, { status: 400 });
    }

    if (body.ai_policy_acknowledged !== true) {
      return NextResponse.json({
        error: "You must acknowledge the LSCSO AI Use Policy before continuing with the application.",
        policy: APPLICATION_AI_POLICY_TEXT,
      }, { status: 400 });
    }

    if (!body.answers || typeof body.answers !== "object" || Array.isArray(body.answers)) {
      return NextResponse.json({ error: "Please submit a valid application answer set." }, { status: 400 });
    }

    if (body.signature_confirmed !== true || body.applicant_certification !== true) {
      return NextResponse.json({ error: "You must electronically sign the applicant certification before submitting." }, { status: 400 });
    }

    const signatureName = clean(body.applicant_signature_name);
    if (!signatureName) {
      return NextResponse.json({ error: "Enter your full name as the electronic signature before submitting." }, { status: 400 });
    }

    const trackingToken = randomBytes(32).toString("base64url");
    const trackingTokenHash = createHash("sha256").update(trackingToken).digest("hex");
    const supabase = await createServerClient() as any;

    const { data, error } = await supabase
      .rpc("submit_recruitment_application", {
        p_answers: body.answers,
        p_signature_name: signatureName,
        p_certification_text: APPLICATION_CERTIFICATION_TEXT,
        p_tracking_token_hash: trackingTokenHash,
        p_ai_policy_acknowledged: true,
        p_tracking_token: trackingToken,
      })
      .single();

    if (error || !data) {
      const message = error?.message || "The application could not be saved.";
      const status = rpcErrorStatus(message);
      if (status >= 500) console.error("Recruitment application RPC failed", error);
      return NextResponse.json({ error: status >= 500 ? "The application could not be saved." : message }, { status });
    }

    return NextResponse.json({
      success: true,
      application_number: data.application_number,
      tracking_token: trackingToken,
    });
  } catch (error) {
    console.error("Recruitment application submission failed", error);
    return NextResponse.json({ error: "The application could not be submitted. Please try again." }, { status: 500 });
  }
}
