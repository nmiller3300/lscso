import { NextResponse } from "next/server";
import { canAccessPersonnelRecord } from "@/lib/authorization/can-access-personnel-record";
import { buildPersonnelRecordPdf } from "@/lib/pdf/simple-personnel-pdf";
import {
  GEORGIA_EXEMPTION_RULE,
  GEORGIA_OPEN_RECORDS_CITATION,
  GEORGIA_OPEN_RECORDS_QUOTE,
  GEORGIA_RESPONSE_RULE,
  SAN_ANDREAS_EXEMPTION_RULE,
  SAN_ANDREAS_OPEN_RECORDS_CITATION,
  SAN_ANDREAS_OPEN_RECORDS_QUOTE,
  SAN_ANDREAS_RESPONSE_RULE,
} from "@/lib/open-records/legal";
import { getCurrentPortalProfile } from "@/lib/supabase/portal-profile";
import { createClient } from "@/lib/supabase/server";

const allowedTiers = new Set(["Executive", "Command"]);
const validSections = new Set(["career", "assignments", "certifications", "training", "awards", "guardians", "administrative"]);
const evaluationLabels: Record<string, string> = {
  professional_conduct: "Professional Conduct",
  policy_knowledge: "Policy Knowledge",
  communication: "Communication",
  judgment_decision_making: "Judgment & Decision-Making",
  report_documentation: "Reports & Documentation",
  officer_safety_tactics: "Officer Safety & Tactics",
  initiative_reliability: "Initiative & Reliability",
  teamwork_leadership: "Teamwork & Leadership",
};

const exportProfiles = {
  normal: {
    label: "Normal Personnel File",
    filename: "Personnel-File",
    publicRelease: false,
    internalMetadata: true,
    allowedSections: ["career", "assignments", "certifications", "training", "awards", "guardians", "administrative"],
  },
  lateral: {
    label: "Lateral Transfer Personnel File",
    filename: "Lateral-Transfer-Personnel-File",
    publicRelease: false,
    internalMetadata: false,
    allowedSections: ["career", "assignments", "certifications", "training", "awards", "guardians"],
  },
  "open-records": {
    label: "Open Records Request Personnel File",
    filename: "Open-Records-Release-Copy",
    publicRelease: true,
    internalMetadata: false,
    allowedSections: ["career", "assignments", "certifications", "training", "awards"],
  },
} as const;

type ExportType = keyof typeof exportProfiles;

function date(value: string | null | undefined) {
  return value ? new Date(value.length === 10 ? `${value}T12:00:00` : value).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" }) : "Not recorded";
}

function text(value: unknown) {
  return String(value ?? "").trim();
}

function pairs(rows: Array<[string, string]>) {
  return rows.map(([label, value]) => ({ text: `${label}: ${value}`, spaceAfter: 1 }));
}

export async function GET(request: Request, { params }: { params: Promise<{ personnelId: string }> }) {
  const actor = await getCurrentPortalProfile();
  if (!actor || !allowedTiers.has(actor.access_tier)) return NextResponse.json({ error: "Command authority required." }, { status: 403 });

  const { personnelId } = await params;
  const access = await canAccessPersonnelRecord(actor, personnelId);
  if (!access.allowed) return NextResponse.json({ error: "You do not have permission to export this personnel record." }, { status: 403 });

  const url = new URL(request.url);
  const exportType = text(url.searchParams.get("exportType")) as ExportType;
  const profile = exportProfiles[exportType];
  if (!profile) return NextResponse.json({ error: "A valid personnel file release type is required." }, { status: 400 });

  const recipient = text(url.searchParams.get("recipient")).slice(0, 160);
  if (recipient.length < 2) return NextResponse.json({ error: "A destination department, agency, or requesting party is required." }, { status: 400 });

  const requested = (url.searchParams.get("sections") ?? "")
    .split(",")
    .map((value) => value.trim())
    .filter((value) => validSections.has(value));
  const allowedForProfile = new Set<string>(profile.allowedSections);
  let sections = requested.filter((value) => allowedForProfile.has(value));
  if (!sections.length) sections = [...profile.allowedSections];

  const supabase = await createClient() as any;
  const { data: member, error: memberError } = await supabase
    .from("personnel_profiles")
    .select("id,personnel_id,display_name,rank,call_sign,division,supervisor_label,status,access_tier,probation_started_at,probation_ends_at,created_at")
    .eq("personnel_id", personnelId.toUpperCase())
    .maybeSingle();

  if (memberError || !member) return NextResponse.json({ error: "Personnel record not found." }, { status: 404 });

  const jobs: Array<PromiseLike<any>> = [];
  const keys: string[] = [];
  const add = (key: string, promise: PromiseLike<any>) => { keys.push(key); jobs.push(promise); };

  if (sections.includes("career")) add("career", supabase.from("personnel_career_events").select("event_type,effective_at,from_rank,to_rank,title,notes").eq("profile_id", member.id).order("effective_at", { ascending: true }));
  if (sections.includes("assignments")) add("assignments", supabase.from("personnel_unit_assignments").select("assignment_type,starts_at,ends_at,notes,organizational_units(name,unit_type)").eq("profile_id", member.id).order("starts_at", { ascending: true }));
  if (sections.includes("certifications")) add("certifications", supabase.from("certifications").select("name,issuer,status,issued_on,expires_on,notes").eq("profile_id", member.id).order("created_at", { ascending: true }));
  if (sections.includes("training")) add("training", supabase.from("personnel_training_records").select("record_type,category,title,provider,completed_on,verification_status,notes,created_at").eq("profile_id", member.id).order("completed_on", { ascending: true, nullsFirst: false }));
  if (sections.includes("awards")) add("awards", supabase.from("personnel_awards").select("award_name,awarded_on,citation,awarded_by").eq("profile_id", member.id).order("awarded_on", { ascending: true }));
  if (sections.includes("guardians")) add("guardians", supabase.from("guardian_records").select("guardian_number,record_type,status,title,incident_at,location,policy_reference,observed_behavior,expected_standard,action_taken,follow_up_plan,employee_response,points_assessed,issued_at,acknowledged_at,closed_at,structured_fields").eq("subject_profile_id", member.id).neq("status", "Draft").order("created_at", { ascending: true }));
  if (sections.includes("administrative")) add("administrative", supabase.from("personnel_flags").select("flag_type,notes,active,created_at,resolved_at").eq("profile_id", member.id).order("created_at", { ascending: true }));

  const settled = await Promise.all(jobs);
  const data = new Map<string, any[]>();
  for (let index = 0; index < keys.length; index += 1) {
    if (settled[index]?.error) return NextResponse.json({ error: `Unable to load ${keys[index]} records.` }, { status: 500 });
    data.set(keys[index], settled[index]?.data ?? []);
  }

  const releaseNotice = profile.publicRelease
    ? [
        { text: "OPEN RECORDS RELEASE COPY", bold: true, size: 11, spaceAfter: 4 },
        { text: `ATTENTION: ${recipient}`, bold: true, size: 10, spaceAfter: 2 },
        { text: `This personnel record concerns the following individual: ${member.display_name} (${member.personnel_id}).`, spaceAfter: 4 },
        { text: "This copy is a public-release review profile. Guardian/accountability records, administrative flags, internal Portal/access information, and internal narrative notes are excluded from this generated copy.", spaceAfter: 4 },
        { text: "A records custodian must still conduct a final releasability and redaction review before disclosure. This export is a review aid and does not independently determine that every included field is legally releasable.", spaceAfter: 4 },
      ]
    : exportType === "lateral"
      ? [
          { text: `ATTENTION: ${recipient}`, bold: true, size: 11, spaceAfter: 4 },
          { text: `This lateral-transfer personnel file concerns: ${member.display_name} (${member.personnel_id}).`, spaceAfter: 4 },
          { text: "INTER-AGENCY EMPLOYMENT / BACKGROUND REVIEW", bold: true, size: 9.5, spaceAfter: 3 },
          { text: "This packet contains department service, qualification, training, recognition, and non-draft accountability history selected for authorized inter-agency employment review. Internal administrative flags and Portal/access-control metadata are not part of this transfer profile.", spaceAfter: 4 },
          { text: "This file may contain confidential, sensitive, or legally protected information. Do not redistribute it outside authorized departmental/background-investigation channels except as permitted or required by law and policy.", spaceAfter: 4 },
        ]
      : [
          { text: `ATTENTION: ${recipient}`, bold: true, size: 11, spaceAfter: 4 },
          { text: `This internal personnel file concerns: ${member.display_name} (${member.personnel_id}).`, spaceAfter: 4 },
          { text: "OFFICIAL USE / FULL INTERNAL PERSONNEL RECORD", bold: true, size: 9.5, spaceAfter: 3 },
          { text: "This is the department's fuller internal personnel export and may include administrative flags, Guardian/accountability material, probation data, supervisory information, and internal access classification. It is not a pre-cleared public-release copy.", spaceAfter: 4 },
          { text: "Requests from members of the public must be processed through the applicable open-records/public-records process. Do not use this internal copy as a substitute for a statutory release and redaction review.", spaceAfter: 4 },
        ];

  const legalLines = [
    { text: "UNITED STATES / STATE OF GEORGIA", bold: true, size: 9.5, spaceAfter: 2 },
    { text: GEORGIA_OPEN_RECORDS_CITATION, bold: true, spaceAfter: 2 },
    { text: `Quoted statutory language: “${GEORGIA_OPEN_RECORDS_QUOTE}”`, spaceAfter: 3 },
    { text: GEORGIA_RESPONSE_RULE, spaceAfter: 3 },
    { text: GEORGIA_EXEMPTION_RULE, spaceAfter: 5 },
    { text: "STATE OF SAN ANDREAS / ROLEPLAY ANALOG", bold: true, size: 9.5, spaceAfter: 2 },
    { text: SAN_ANDREAS_OPEN_RECORDS_CITATION, bold: true, spaceAfter: 2 },
    { text: `Quoted RP statutory language: “${SAN_ANDREAS_OPEN_RECORDS_QUOTE}”`, spaceAfter: 3 },
    { text: SAN_ANDREAS_RESPONSE_RULE, spaceAfter: 3 },
    { text: SAN_ANDREAS_EXEMPTION_RULE, spaceAfter: 3 },
  ];

  const publicSummary: Array<[string, string]> = [
    ["Personnel ID", member.personnel_id],
    ["Name", member.display_name],
    ["Rank", member.rank],
    ["Call Sign", member.call_sign ?? "Not assigned"],
    ["Status", member.status],
    ["Division", member.division ?? "Not recorded"],
  ];
  const lateralSummary: Array<[string, string]> = [
    ...publicSummary,
    ["Supervisor", member.supervisor_label ?? "Not recorded"],
  ];
  const internalSummary: Array<[string, string]> = [
    ...lateralSummary,
    ["Portal Classification", member.access_tier],
    ["Probation Start", date(member.probation_started_at)],
    ["Probation End", date(member.probation_ends_at)],
  ];
  const summaryRows = profile.publicRelease ? publicSummary : profile.internalMetadata ? internalSummary : lateralSummary;

  const pdfSections: any[] = [
    { title: profile.publicRelease ? "Release Notice" : "Transmittal Notice", lines: releaseNotice },
    { title: "Legal Framework", lines: legalLines },
    { title: "Service Summary", lines: pairs(summaryRows) },
  ];

  if (data.has("career")) pdfSections.push({
    title: "Career / Service History",
    lines: data.get("career")!.flatMap((row: any) => [
      { text: `${date(row.effective_at)} - ${text(row.title) || text(row.event_type)}`, bold: true, spaceAfter: 1 },
      ...(row.from_rank || row.to_rank ? [{ text: `Rank: ${row.from_rank ?? "-"} -> ${row.to_rank ?? "-"}`, indent: 12, spaceAfter: 1 }] : []),
      ...(!profile.publicRelease && row.notes ? [{ text: text(row.notes), indent: 12, spaceAfter: 4 }] : []),
    ]),
  });

  if (data.has("assignments")) pdfSections.push({
    title: "Assignments",
    lines: data.get("assignments")!.flatMap((row: any) => {
      const unit = Array.isArray(row.organizational_units) ? row.organizational_units[0] : row.organizational_units;
      return [
        { text: `${unit?.name ?? "Unknown unit"} - ${row.assignment_type}`, bold: true, spaceAfter: 1 },
        { text: `${date(row.starts_at)} to ${row.ends_at ? date(row.ends_at) : "Current"}${!profile.publicRelease && row.notes ? ` - ${row.notes}` : ""}`, indent: 12, spaceAfter: 4 },
      ];
    }),
  });

  if (data.has("certifications")) pdfSections.push({
    title: "Certifications",
    lines: data.get("certifications")!.flatMap((row: any) => [
      { text: `${row.name} - ${row.status}`, bold: true, spaceAfter: 1 },
      { text: `Issuer: ${row.issuer ?? "Not recorded"} | Issued: ${date(row.issued_on)} | Expires: ${row.expires_on ? date(row.expires_on) : "No expiration"}`, indent: 12, spaceAfter: 1 },
      ...(!profile.publicRelease && row.notes ? [{ text: text(row.notes), indent: 12, spaceAfter: 4 }] : []),
    ]),
  });

  if (data.has("training")) pdfSections.push({
    title: "Training Record",
    lines: data.get("training")!.flatMap((row: any) => [
      { text: `${row.title} - ${row.record_type}${row.category ? ` / ${row.category}` : ""}`, bold: true, spaceAfter: 1 },
      { text: `Provider: ${row.provider ?? "LSCSO"} | Completed: ${date(row.completed_on)} | ${row.verification_status ?? "Recorded"}`, indent: 12, spaceAfter: 1 },
      ...(!profile.publicRelease && row.notes ? [{ text: text(row.notes), indent: 12, spaceAfter: 4 }] : []),
    ]),
  });

  if (data.has("awards")) pdfSections.push({
    title: "Awards / Recognition",
    lines: data.get("awards")!.flatMap((row: any) => [
      { text: `${row.award_name} - ${date(row.awarded_on)}`, bold: true, spaceAfter: 1 },
      ...(row.citation ? [{ text: text(row.citation), indent: 12, spaceAfter: 4 }] : []),
    ]),
  });

  if (data.has("guardians")) {
    const guardianRows = data.get("guardians")!.filter((row: any) => row.structured_fields?.lifecycle_state !== "Scheduled");
    pdfSections.push({
      title: exportType === "lateral" ? "Accountability / Evaluation History" : "Guardian Record",
      lines: guardianRows.flatMap((row: any) => {
        if (row.record_type === "Performance Evaluation") {
          const fields = row.structured_fields && typeof row.structured_fields === "object" ? row.structured_fields : {};
          const ratings = fields.ratings && typeof fields.ratings === "object" ? fields.ratings : {};
          const ratingLine = Object.entries(evaluationLabels).map(([key, label]) => `${label}: ${Number(ratings[key] ?? 0)}/5`).join(" | ");
          return [
            { text: `G-${String(row.guardian_number).padStart(4, "0")} - Performance Evaluation - ${row.status}`, bold: true, spaceAfter: 1 },
            { text: `${fields.evaluation_kind ?? "Performance"} | Review period: ${date(fields.period_start)} to ${date(fields.period_end)} | Overall: ${Number(fields.overall_average ?? 0).toFixed(2)}/5 - ${fields.overall_rating ?? "Not rated"}`, indent: 12, spaceAfter: 2 },
            { text: ratingLine, indent: 12, spaceAfter: 2 },
            { text: `Overall assessment: ${text(fields.supervisor_summary ?? row.observed_behavior)}`, indent: 12, spaceAfter: 2 },
            { text: `Strengths: ${text(fields.strengths ?? row.action_taken)}`, indent: 12, spaceAfter: 2 },
            { text: `Improvement areas: ${text(fields.improvement_areas ?? row.expected_standard)}`, indent: 12, spaceAfter: 2 },
            { text: `Goals: ${text(fields.goals ?? row.follow_up_plan)}`, indent: 12, spaceAfter: 2 },
            ...(fields.remediation_required ? [{ text: `Required remediation / training: ${text(fields.remediation_plan) || "Required"}`, indent: 12, spaceAfter: 2 }] : []),
            ...(row.employee_response ? [{ text: `Member response: ${text(row.employee_response)}`, indent: 12, spaceAfter: 4 }] : []),
          ];
        }
        const detail = [
          row.observed_behavior,
          row.expected_standard ? `Expected standard: ${row.expected_standard}` : null,
          row.action_taken ? `Action: ${row.action_taken}` : null,
          row.follow_up_plan ? `Follow-up: ${row.follow_up_plan}` : null,
          row.employee_response ? `Employee response: ${row.employee_response}` : null,
        ].filter(Boolean).map((value) => ({ text: text(value), indent: 12, spaceAfter: 2 }));
        return [
          { text: `G-${String(row.guardian_number).padStart(4, "0")} - ${row.record_type} - ${row.status}`, bold: true, spaceAfter: 1 },
          { text: `${row.title} | Incident: ${date(row.incident_at)}${row.location ? ` | ${row.location}` : ""}${row.points_assessed ? ` | Points: ${row.points_assessed}` : ""}`, indent: 12, spaceAfter: 2 },
          ...detail,
        ];
      }),
    });
  }

  if (data.has("administrative")) pdfSections.push({
    title: "Administrative Flags",
    lines: data.get("administrative")!.flatMap((row: any) => [
      { text: `${row.flag_type} - ${row.active ? "Active" : "Resolved"}`, bold: true, spaceAfter: 1 },
      { text: `Opened: ${date(row.created_at)}${row.resolved_at ? ` | Resolved: ${date(row.resolved_at)}` : ""}${row.notes ? ` | ${row.notes}` : ""}`, indent: 12, spaceAfter: 4 },
    ]),
  });

  const generatedAt = new Date().toLocaleString("en-US", { year: "numeric", month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZoneName: "short" });
  const generatedBy = `${actor.rank} ${actor.display_name}`;
  const purpose = `${profile.label} | Destination: ${recipient}`;
  const pdf = buildPersonnelRecordPdf({
    departmentName: "LOS SANTOS COUNTY SHERIFF'S OFFICE",
    title: `${profile.label} - ${member.display_name}`,
    subtitle: `${member.rank} | ${member.personnel_id} | ${member.call_sign ?? "No call sign"}`,
    generatedAt,
    generatedBy,
    purpose,
    sections: pdfSections,
  });

  const { error: auditError } = await supabase.rpc("record_personnel_record_export", {
    p_subject_profile_id: member.id,
    p_purpose: purpose,
    p_sections: sections,
  });
  if (auditError) console.error("[Personnel Record Export Audit]", auditError);

  const safeName = member.display_name.replace(/[^A-Za-z0-9]+/g, "-").replace(/^-|-$/g, "");
  const filename = `LSCSO-${member.personnel_id}-${safeName}-${profile.filename}.pdf`;
  return new NextResponse(pdf, {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store, private",
    },
  });
}
