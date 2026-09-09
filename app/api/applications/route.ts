import { NextResponse } from "next/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { APPLICATION_CERTIFICATION_TEXT, applicationLabel } from "@/lib/recruitment/application";
import { getRecruitmentApplicationQuestions } from "@/lib/recruitment/questions.server";

const legacyTextColumns = new Set([
  "timezone", "fivem_experience", "previous_departments", "weekly_hours", "upcoming_commitments",
  "why_lscso", "contribution", "drug_use_history", "serious_roleplay_definition",
  "reasonable_suspicion_probable_cause", "use_of_force_factors", "scenario_speeding_nervous",
  "scenario_deputy_policy_violation", "scenario_supervisor_order",
]);

function cleanAnswer(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    if (!body || typeof body !== "object") return NextResponse.json({ error: "Invalid application." }, { status: 400 });

    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) {
      return NextResponse.json({ error: "Application service is not configured." }, { status: 503 });
    }

    const supabase = createServiceClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
    const [{ data: recruitmentStatus, error: recruitmentStatusError }, questions] = await Promise.all([
      supabase.from("recruitment_settings").select("applications_open").eq("id", "applications").maybeSingle(),
      getRecruitmentApplicationQuestions(false),
    ]);

    if (recruitmentStatusError || recruitmentStatus?.applications_open !== true) {
      return NextResponse.json({ error: "LSCSO applications are currently closed. New submissions are not being accepted." }, { status: 403 });
    }
    if (!questions.length) return NextResponse.json({ error: "The application form is not currently configured." }, { status: 503 });

    const submittedAnswers = body.answers && typeof body.answers === "object" ? body.answers as Record<string, unknown> : {};
    const normalizedAnswers: Record<string, string> = {};

    for (const question of questions) {
      const value = cleanAnswer(submittedAnswers[question.questionKey]);
      if (question.required && !value) {
        return NextResponse.json({ error: "Please answer every required application question." }, { status: 400 });
      }
      if (value.length > 8000) return NextResponse.json({ error: "Application answers cannot exceed 8,000 characters." }, { status: 400 });
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
    if (fullName.length < 2 || fullName.length > 120) return NextResponse.json({ error: "Please enter a valid full name." }, { status: 400 });
    if (discordUsername.length < 2 || discordUsername.length > 100) return NextResponse.json({ error: "Please enter a valid Discord username." }, { status: 400 });

    let age: number | null = null;
    if (normalizedAnswers.age) {
      const parsedAge = Number(normalizedAnswers.age);
      if (!Number.isInteger(parsedAge) || parsedAge < 13 || parsedAge > 100) return NextResponse.json({ error: "Please enter a valid age between 13 and 100." }, { status: 400 });
      age = parsedAge;
    }
    if (normalizedAnswers.timezone && (normalizedAnswers.timezone.length < 2 || normalizedAnswers.timezone.length > 80)) {
      return NextResponse.json({ error: "Please enter a valid timezone." }, { status: 400 });
    }

    const signatureName = cleanAnswer(body.applicant_signature_name);
    if (body.signature_confirmed !== true || body.applicant_certification !== true) {
      return NextResponse.json({ error: "You must electronically sign the applicant certification before submitting." }, { status: 400 });
    }
    if (signatureName.length < 2 || signatureName.length > 120 || signatureName.toLocaleLowerCase() !== fullName.toLocaleLowerCase()) {
      return NextResponse.json({ error: "Your electronic signature must match the full name on your application." }, { status: 400 });
    }

    const sessionClient = await createServerClient();
    const { data: { user } } = await sessionClient.auth.getUser();
    const { data: recent } = await supabase
      .from("recruitment_applications")
      .select("application_number")
      .ilike("discord_username", discordUsername)
      .gte("created_at", new Date(Date.now() - 86400000).toISOString())
      .not("status", "in", "(Withdrawn,Archived)")
      .limit(1)
      .maybeSingle();

    if (recent) {
      return NextResponse.json({ error: `An application for this Discord account was already submitted in the last 24 hours (${applicationLabel(recent.application_number)}). Please wait for Command review instead of submitting a duplicate.` }, { status: 409 });
    }

    const insert: Record<string, unknown> = {
      full_name: fullName,
      discord_username: discordUsername,
      age,
      status: "Submitted",
      mandatory_training: "Yes",
      prior_discipline: "No",
      prior_discipline_explanation: "",
      applicant_certification: true,
      applicant_signature_name: signatureName,
      applicant_signed_at: new Date().toISOString(),
      applicant_signature_method: "Click to sign",
      applicant_certification_text: APPLICATION_CERTIFICATION_TEXT,
      application_answers: normalizedAnswers,
      application_question_snapshot: questions,
    };

    for (const [questionKey, value] of Object.entries(normalizedAnswers)) {
      if (legacyTextColumns.has(questionKey)) insert[questionKey] = value;
    }
    if (user?.id) insert.applicant_auth_user_id = user.id;

    const { data, error } = await supabase
      .from("recruitment_applications")
      .insert(insert)
      .select("id,application_number,applicant_signed_at")
      .single();

    if (error || !data) {
      console.error("Recruitment application insert failed", error);
      return NextResponse.json({ error: "The application could not be saved." }, { status: 500 });
    }

    await supabase.from("recruitment_application_history").insert({
      application_id: data.id,
      event_type: "Submitted",
      details: {
        application_number: data.application_number,
        electronically_signed: true,
        signed_at: data.applicant_signed_at,
        question_count: questions.length,
      },
    });

    return NextResponse.json({ success: true, application_number: data.application_number });
  } catch (error) {
    console.error("Recruitment application submission failed", error);
    return NextResponse.json({ error: "The application could not be submitted. Please try again." }, { status: 500 });
  }
}
