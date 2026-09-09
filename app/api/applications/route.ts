import { createHash, randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { APPLICATION_AI_POLICY_TEXT, APPLICATION_CERTIFICATION_TEXT } from "@/lib/recruitment/application";
import { getRecruitmentApplicationQuestions } from "@/lib/recruitment/questions.server";

function cleanAnswer(value: unknown) {
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
    normalized.includes("cannot exceed")
  ) return 400;
  return 500;
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    if (!body || typeof body !== "object") {
      return NextResponse.json({ error: "Invalid application." }, { status: 400 });
    }

    if (body.ai_policy_acknowledged !== true) {
      return NextResponse.json({
        error: "You must acknowledge the LSCSO AI Use Policy before continuing with the application.",
        policy: APPLICATION_AI_POLICY_TEXT,
      }, { status: 400 });
    }

    const supabase = await createServerClient() as any;
    const [{ data: recruitmentStatus, error: recruitmentStatusError }, questions] = await Promise.all([
      supabase.from("recruitment_settings").select("applications_open").eq("id", "applications").maybeSingle(),
      getRecruitmentApplicationQuestions(false),
    ]);

    if (recruitmentStatusError || recruitmentStatus?.applications_open !== true) {
      return NextResponse.json({ error: "LSCSO applications are currently closed. New submissions are not being accepted." }, { status: 403 });
    }
    if (!questions.length) {
      return NextResponse.json({ error: "The application form is not currently configured." }, { status: 503 });
    }

    const submittedAnswers = body.answers && typeof body.answers === "object"
      ? body.answers as Record<string, unknown>
      : {};
    const normalizedAnswers: Record<string, string> = {};

    for (const question of questions) {
      const value = cleanAnswer(submittedAnswers[question.questionKey]);
      if (question.required && !value) {
        return NextResponse.json({ error: "Please answer every required application question." }, { status: 400 });
      }
      if (value.length > 8000) {
        return NextResponse.json({ error: "Application answers cannot exceed 8,000 characters." }, { status: 400 });
      }
      if (question.questionType === "multiple_choice" && value && !question.options.includes(value)) {
        return NextResponse.json({ error: `Select a valid answer for: ${question.prompt}` }, { status: 400 });
      }
      if (question.questionType === "yes_no" && value && !["Yes", "No"].includes(value)) {
        return NextResponse.json({ error: `Select Yes or No for: ${question.prompt}` }, { status: 400 });
      }
      if (value) normalizedAnswers[question.questionKey] = value;
    }

    const fullName = cleanAnswer(normalizedAnswers.full_name);
    const discordUsername = cleanAnswer(normalizedAnswers.discord_username);
    if (fullName.length < 2 || fullName.length > 120) {
      return NextResponse.json({ error: "Please enter a valid full name." }, { status: 400 });
    }
    if (discordUsername.length < 2 || discordUsername.length > 100) {
      return NextResponse.json({ error: "Please enter a valid Discord username." }, { status: 400 });
    }

    if (normalizedAnswers.age) {
      const parsedAge = Number(normalizedAnswers.age);
      if (!Number.isInteger(parsedAge) || parsedAge < 13 || parsedAge > 100) {
        return NextResponse.json({ error: "Please enter a valid age between 13 and 100." }, { status: 400 });
      }
    }
    if (normalizedAnswers.timezone && (normalizedAnswers.timezone.length < 2 || normalizedAnswers.timezone.length > 80)) {
      return NextResponse.json({ error: "Please enter a valid timezone." }, { status: 400 });
    }

    const signatureName = cleanAnswer(body.applicant_signature_name);
    if (body.signature_confirmed !== true || body.applicant_certification !== true) {
      return NextResponse.json({ error: "You must electronically sign the applicant certification before submitting." }, { status: 400 });
    }
    if (
      signatureName.length < 2 ||
      signatureName.length > 120 ||
      signatureName.toLocaleLowerCase() !== fullName.toLocaleLowerCase()
    ) {
      return NextResponse.json({ error: "Your electronic signature must match the full name on your application." }, { status: 400 });
    }

    const trackingToken = randomBytes(32).toString("base64url");
    const trackingTokenHash = createHash("sha256").update(trackingToken).digest("hex");

    const { data, error } = await supabase
      .rpc("submit_recruitment_application", {
        p_answers: normalizedAnswers,
        p_signature_name: signatureName,
        p_certification_text: APPLICATION_CERTIFICATION_TEXT,
        p_tracking_token_hash: trackingTokenHash,
        p_ai_policy_acknowledged: true,
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
