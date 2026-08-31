import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const requiredFields = [
  "full_name","discord_username","age","timezone","fivem_experience","serious_rp_experience","weekly_hours","upcoming_commitments","mandatory_training","previous_departments","previous_ranks","supervisory_experience","serious_roleplay_definition","good_le_roleplayer","why_lscso","lscso_goals","career_path","department_expectations","contribution","reasonable_suspicion_probable_cause","officer_discretion","use_of_force_factors","radio_communication","scenario_speeding_nervous","scenario_fleeing_vehicle","scenario_warrant","scenario_deputy_policy_violation","scenario_supervisor_order","prior_discipline","prior_discipline_explanation","breaking_character","friend_policy_violation","protect_fellow_officer","honesty_importance","anything_else","self_improvement","policy_agreement"
];

export async function POST(request: Request) {
  try {
    const body = await request.json();
    if (!body || typeof body !== "object") return NextResponse.json({ error: "Invalid application." }, { status: 400 });
    for (const field of requiredFields) {
      if (typeof body[field] !== "string" || !body[field].trim()) return NextResponse.json({ error: "Please answer every application question." }, { status: 400 });
    }
    const age = Number(body.age);
    if (!Number.isInteger(age) || age < 13 || age > 100) return NextResponse.json({ error: "Please enter a valid age." }, { status: 400 });
    if (body.mandatory_training !== "Yes" || body.policy_agreement !== "Yes" || body.applicant_certification !== true) return NextResponse.json({ error: "Required acknowledgments were not accepted." }, { status: 400 });

    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) return NextResponse.json({ error: "Application service is not configured." }, { status: 503 });
    const supabase = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });

    const insert = { ...body, age, status: "Pending", applicant_certification: true };
    const { data, error } = await supabase.from("recruitment_applications").insert(insert).select("application_number").single();
    if (error) return NextResponse.json({ error: "The application could not be saved." }, { status: 500 });

    const webhook = process.env.LSCSO_DISCORD_APPLICATION_WEBHOOK;
    if (webhook) {
      const site = process.env.NEXT_PUBLIC_SITE_URL || new URL(request.url).origin;
      const embed = {
        title: "🚨 New LSCSO Application",
        description: `Application **#${data.application_number}** has been submitted for command review.`,
        fields: [
          { name: "Applicant", value: body.full_name, inline: true },
          { name: "Discord", value: body.discord_username, inline: true },
          { name: "Age", value: String(age), inline: true },
          { name: "Timezone", value: body.timezone, inline: true },
          { name: "FiveM Experience", value: body.fivem_experience.slice(0,1024), inline: false },
          { name: "Career Interest", value: body.career_path.slice(0,1024), inline: false },
        ],
        footer: { text: "LSCSO Recruitment" },
        timestamp: new Date().toISOString(),
      };
      await fetch(webhook, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ embeds: [embed], components: [{ type: 1, components: [{ type: 2, style: 5, label: "Review Application", url: `${site}/portal/applications/${data.application_number}` }] }] }) }).catch(() => null);
    }
    return NextResponse.json({ success: true, application_number: data.application_number });
  } catch { return NextResponse.json({ error: "The application could not be submitted." }, { status: 500 }); }
}
