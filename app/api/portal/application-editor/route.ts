import { NextResponse } from "next/server";
import { getCurrentPortalProfile } from "@/lib/supabase/portal-profile";
import { APPLICATION_QUESTION_TYPES, type ApplicationQuestionType } from "@/lib/recruitment/application";
import { getRecruitmentQuestionServiceClient } from "@/lib/recruitment/questions.server";

const EDITOR_RANKS = new Set(["Sheriff", "Undersheriff"]);
const QUESTION_TYPES = new Set<string>(APPLICATION_QUESTION_TYPES);

function clean(value: unknown, max = 1200) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function cleanOptions(value: unknown) {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.map((option) => clean(option, 160)).filter(Boolean))].slice(0, 20);
}

function normalizeType(value: unknown): ApplicationQuestionType | null {
  const type = clean(value, 40);
  return QUESTION_TYPES.has(type) ? type as ApplicationQuestionType : null;
}

function makeQuestionKey(prompt: string) {
  const base = prompt.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 42) || "question";
  return `custom_${base}_${crypto.randomUUID().replaceAll("-", "").slice(0, 8)}`;
}

async function authorize() {
  const profile = await getCurrentPortalProfile();
  if (!profile || !EDITOR_RANKS.has(profile.rank)) return null;
  return profile;
}

export async function POST(request: Request) {
  const profile = await authorize();
  if (!profile) return NextResponse.json({ error: "Only the Sheriff or Undersheriff may edit the application form." }, { status: 403 });
  const supabase = getRecruitmentQuestionServiceClient();
  if (!supabase) return NextResponse.json({ error: "Recruitment editor service is unavailable." }, { status: 503 });

  try {
    const body = await request.json();
    const action = clean(body?.action, 40);
    const now = new Date().toISOString();

    if (action === "create") {
      const prompt = clean(body.prompt);
      const sectionTitle = clean(body.sectionTitle, 120);
      const sectionShortTitle = clean(body.sectionShortTitle, 80) || sectionTitle;
      const sectionEyebrow = clean(body.sectionEyebrow, 100) || "Candidate Review";
      const sectionDescription = clean(body.sectionDescription, 600) || "Complete each question carefully and answer in your own words.";
      const questionType = normalizeType(body.questionType);
      const options = cleanOptions(body.options);
      if (prompt.length < 3 || sectionTitle.length < 2 || !questionType) return NextResponse.json({ error: "Question, section, and format are required." }, { status: 400 });
      if (questionType === "multiple_choice" && options.length < 2) return NextResponse.json({ error: "Multiple choice questions need at least two answer options." }, { status: 400 });

      const { data: last } = await supabase.from("recruitment_application_questions").select("sort_order").order("sort_order", { ascending: false }).limit(1).maybeSingle();
      const { data, error } = await supabase.from("recruitment_application_questions").insert({
        question_key: makeQuestionKey(prompt),
        section_title: sectionTitle,
        section_short_title: sectionShortTitle,
        section_eyebrow: sectionEyebrow,
        section_description: sectionDescription,
        prompt,
        question_type: questionType,
        help_text: clean(body.helpText, 800) || null,
        placeholder: clean(body.placeholder, 300) || null,
        options: questionType === "multiple_choice" ? options : [],
        required: body.required !== false,
        active: true,
        sort_order: (Number(last?.sort_order) || 0) + 10,
        system_field: null,
        locked: false,
        created_by_profile_id: profile.id,
        updated_by_profile_id: profile.id,
        updated_at: now,
      }).select("*").single();
      if (error) throw error;
      return NextResponse.json({ success: true, question: data });
    }

    if (action === "update") {
      const id = clean(body.id, 100);
      if (!id) return NextResponse.json({ error: "Question ID is required." }, { status: 400 });
      const { data: current, error: currentError } = await supabase.from("recruitment_application_questions").select("*").eq("id", id).maybeSingle();
      if (currentError) throw currentError;
      if (!current) return NextResponse.json({ error: "Question not found." }, { status: 404 });

      const prompt = clean(body.prompt);
      const sectionTitle = clean(body.sectionTitle, 120);
      const questionType = current.locked ? current.question_type : normalizeType(body.questionType);
      const options = cleanOptions(body.options);
      if (prompt.length < 3 || sectionTitle.length < 2 || !questionType) return NextResponse.json({ error: "Question, section, and format are required." }, { status: 400 });
      if (questionType === "multiple_choice" && options.length < 2) return NextResponse.json({ error: "Multiple choice questions need at least two answer options." }, { status: 400 });

      const update: Record<string, unknown> = {
        section_title: sectionTitle,
        section_short_title: clean(body.sectionShortTitle, 80) || sectionTitle,
        section_eyebrow: clean(body.sectionEyebrow, 100) || "Candidate Review",
        section_description: clean(body.sectionDescription, 600) || "Complete each question carefully and answer in your own words.",
        prompt,
        question_type: questionType,
        help_text: clean(body.helpText, 800) || null,
        placeholder: clean(body.placeholder, 300) || null,
        options: questionType === "multiple_choice" ? options : [],
        required: current.locked ? true : body.required !== false,
        active: current.locked ? true : body.active !== false,
        updated_by_profile_id: profile.id,
        updated_at: now,
      };

      const { data, error } = await supabase.from("recruitment_application_questions").update(update).eq("id", id).select("*").single();
      if (error) throw error;
      return NextResponse.json({ success: true, question: data });
    }

    if (action === "set_active") {
      const id = clean(body.id, 100);
      const active = body.active === true;
      const { data: current, error: currentError } = await supabase.from("recruitment_application_questions").select("id,locked").eq("id", id).maybeSingle();
      if (currentError) throw currentError;
      if (!current) return NextResponse.json({ error: "Question not found." }, { status: 404 });
      if (current.locked && !active) return NextResponse.json({ error: "Full Name and Discord Username are required system fields and cannot be removed." }, { status: 400 });
      const { error } = await supabase.from("recruitment_application_questions").update({ active, updated_by_profile_id: profile.id, updated_at: now }).eq("id", id);
      if (error) throw error;
      return NextResponse.json({ success: true });
    }

    if (action === "reorder") {
      const ids = Array.isArray(body.ids) ? body.ids.map((id: unknown) => clean(id, 100)).filter(Boolean) : [];
      if (!ids.length || new Set(ids).size !== ids.length) return NextResponse.json({ error: "Invalid question order." }, { status: 400 });
      const { data: existing, error: existingError } = await supabase.from("recruitment_application_questions").select("id").in("id", ids);
      if (existingError) throw existingError;
      if ((existing ?? []).length !== ids.length) return NextResponse.json({ error: "One or more questions could not be found." }, { status: 400 });
      for (let index = 0; index < ids.length; index += 1) {
        const { error } = await supabase.from("recruitment_application_questions").update({ sort_order: (index + 1) * 10, updated_by_profile_id: profile.id, updated_at: now }).eq("id", ids[index]);
        if (error) throw error;
      }
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: "Invalid editor action." }, { status: 400 });
  } catch (error) {
    console.error("Recruitment application editor failed", error);
    return NextResponse.json({ error: "The application form could not be updated." }, { status: 500 });
  }
}
