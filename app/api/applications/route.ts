import { NextResponse } from "next/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { applicationLabel } from "@/lib/recruitment/application";

const requiredFields = ["full_name","discord_username","age","timezone","fivem_experience","serious_rp_experience","weekly_hours","upcoming_commitments","mandatory_training","previous_departments","previous_ranks","supervisory_experience","serious_roleplay_definition","good_le_roleplayer","why_lscso","lscso_goals","career_path","department_expectations","contribution","reasonable_suspicion_probable_cause","officer_discretion","use_of_force_factors","radio_communication","scenario_speeding_nervous","scenario_fleeing_vehicle","scenario_warrant","scenario_deputy_policy_violation","scenario_supervisor_order","prior_discipline","prior_discipline_explanation","breaking_character","friend_policy_violation","protect_fellow_officer","honesty_importance","anything_else","self_improvement","policy_agreement"];

export async function POST(request: Request) {
  try {
    const body = await request.json();
    if (!body || typeof body !== "object") return NextResponse.json({ error: "Invalid application." }, { status: 400 });
    for (const field of requiredFields) if (typeof body[field] !== "string" || !body[field].trim() || body[field].trim().length > 8000) return NextResponse.json({ error: "Please answer every application question using no more than 8,000 characters." }, { status: 400 });
    const age = Number(body.age);
    if (!Number.isInteger(age) || age < 13 || age > 100) return NextResponse.json({ error: "Please enter a valid age." }, { status: 400 });
    if (body.mandatory_training !== "Yes" || body.policy_agreement !== "Yes" || body.applicant_certification !== true) return NextResponse.json({ error: "Required acknowledgments were not accepted." }, { status: 400 });
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL, key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) return NextResponse.json({ error: "Application service is not configured." }, { status: 503 });
    const supabase = createServiceClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
    const sessionClient = await createServerClient();
    const { data: { user } } = await sessionClient.auth.getUser();
    const { data: recent } = await supabase.from("recruitment_applications").select("application_number")
      .ilike("discord_username", body.discord_username.trim()).gte("submitted_at", new Date(Date.now() - 86400000).toISOString())
      .not("status", "in", "(Withdrawn,Archived)").limit(1).maybeSingle();
    if (recent) return NextResponse.json({ error: `An application for this Discord account was already submitted in the last 24 hours (${applicationLabel(recent.application_number)}). Please wait for Command review instead of submitting a duplicate.` }, { status: 409 });
    const insert = Object.fromEntries(requiredFields.map((field) => [field, body[field].trim()])) as Record<string, unknown>;
    Object.assign(insert, { age, status: "Submitted", submitted_at: new Date().toISOString(), applicant_certification: true, applicant_auth_user_id: user?.id ?? null });
    const { data, error } = await supabase.from("recruitment_applications").insert(insert).select("id,application_number").single();
    if (error || !data) return NextResponse.json({ error: "The application could not be saved." }, { status: 500 });
    await supabase.from("recruitment_application_history").insert({ application_id: data.id, event_type: "Submitted", details: { application_number: data.application_number } });
    const webhook = process.env.LSCSO_DISCORD_APPLICATION_WEBHOOK;
    if (webhook) {
      const site = process.env.NEXT_PUBLIC_SITE_URL || new URL(request.url).origin;
      const embed = { title: "LSCSO RECRUITMENT", description: "New Application Received", fields: [{ name: "Application", value: applicationLabel(data.application_number), inline: true }, { name: "Applicant", value: body.full_name.trim().slice(0, 1024), inline: true }, { name: "Submitted", value: new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" }), inline: true }, { name: "Status", value: "Submitted", inline: true }], footer: { text: "LSCSO Recruitment" }, timestamp: new Date().toISOString() };
      await fetch(webhook, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ embeds: [embed], components: [{ type: 1, components: [{ type: 2, style: 5, label: "Review Application", url: `${site}/portal/command/applications/${data.id}` }] }] }) }).catch(() => null);
    }
    return NextResponse.json({ success: true, application_number: data.application_number });
  } catch { return NextResponse.json({ error: "The application could not be submitted. Please try again." }, { status: 500 }); }
}
