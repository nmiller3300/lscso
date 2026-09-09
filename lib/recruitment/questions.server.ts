import { createClient } from "@/lib/supabase/server";
import type { RecruitmentApplicationQuestion } from "./application";

function mapQuestion(row: any): RecruitmentApplicationQuestion {
  return {
    id: String(row.id),
    questionKey: String(row.question_key),
    sectionTitle: String(row.section_title),
    sectionShortTitle: String(row.section_short_title),
    sectionEyebrow: String(row.section_eyebrow),
    sectionDescription: String(row.section_description),
    prompt: String(row.prompt),
    questionType: row.question_type,
    helpText: row.help_text ?? null,
    placeholder: row.placeholder ?? null,
    options: Array.isArray(row.options) ? row.options.map((option: unknown) => String(option)) : [],
    required: row.required === true,
    active: row.active === true,
    sortOrder: Number(row.sort_order) || 0,
    systemField: row.system_field ?? null,
    locked: row.locked === true,
  };
}

export async function getRecruitmentApplicationQuestions(includeInactive = false): Promise<RecruitmentApplicationQuestion[]> {
  const supabase = await createClient() as any;

  let query = supabase
    .from("recruitment_application_questions")
    .select("id,question_key,section_title,section_short_title,section_eyebrow,section_description,prompt,question_type,help_text,placeholder,options,required,active,sort_order,system_field,locked")
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });

  if (!includeInactive) query = query.eq("active", true);
  const { data, error } = await query;
  if (error || !data) return [];
  return data.map(mapQuestion);
}