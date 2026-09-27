import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { GuardianRecordDocument } from "../../../_components/GuardianRecordDocument";
import { PortalShell } from "../../../_components/PortalShell";
import { createClient } from "@/lib/supabase/server";

type GuardianRecordPageProps = { params: Promise<{ guardianNumber: string }> };

const evaluationRatingLabels: Record<string, string> = {
  professional_conduct: "Professional Conduct",
  policy_knowledge: "Policy Knowledge",
  communication: "Communication",
  judgment_decision_making: "Judgment & Decision-Making",
  report_documentation: "Reports & Documentation",
  officer_safety_tactics: "Officer Safety & Tactics",
  initiative_reliability: "Initiative & Reliability",
  teamwork_leadership: "Teamwork & Leadership",
};

function dateOnly(value: unknown) {
  const text = String(value ?? "");
  if (!text) return "Not recorded";
  const date = new Date(text.length === 10 ? `${text}T12:00:00` : text);
  if (Number.isNaN(date.getTime())) return text;
  return date.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

function dateTime(value: unknown) {
  const text = String(value ?? "");
  if (!text) return "Not recorded";
  const date = new Date(text.length === 10 ? `${text}T12:00:00` : text);
  if (Number.isNaN(date.getTime())) return text;
  return date.toLocaleString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export default async function GuardianRecordPage({ params }: GuardianRecordPageProps) {
  const { guardianNumber } = await params;
  const numeric = Number(guardianNumber);
  if (!Number.isFinite(numeric)) notFound();

  const supabase = await createClient() as any;
  const { data: record } = await supabase
    .from("guardian_records")
    .select("*")
    .eq("guardian_number", numeric)
    .maybeSingle();

  if (!record) notFound();

  const fields = record.structured_fields && typeof record.structured_fields === "object"
    ? record.structured_fields as Record<string, any>
    : {};

  if (fields.lifecycle_state === "Scheduled") {
    redirect("/portal/command/guardians/evaluations");
  }

  const [
    { data: subject },
    { data: author },
    { data: acknowledgment },
  ] = await Promise.all([
    supabase
      .from("personnel_profiles")
      .select("personnel_id,display_name,rank,call_sign")
      .eq("id", record.subject_profile_id)
      .maybeSingle(),
    supabase
      .from("personnel_profiles")
      .select("personnel_id,display_name,rank,call_sign")
      .eq("id", record.author_profile_id)
      .maybeSingle(),
    supabase
      .from("guardian_acknowledgments")
      .select("fingerprint_id,typed_name,signature_method,acknowledgment_text,personnel_id_snapshot,display_name_snapshot,rank_snapshot,call_sign_snapshot,response_text,signed_at")
      .eq("guardian_id", record.id)
      .maybeSingle(),
  ]);

  const isEvaluation = record.record_type === "Performance Evaluation";
  const ratings = fields.ratings && typeof fields.ratings === "object"
    ? fields.ratings as Record<string, number>
    : {};
  const ratingEntries = Object.entries(evaluationRatingLabels).map(([key, label]) => ({
    key,
    label,
    value: Number(ratings[key] ?? 0),
  }));

  const category = Array.isArray(fields.categories)
    ? fields.categories.map(String).join(", ")
    : String(record.title ?? "").includes(":")
      ? String(record.title).split(":").slice(1).join(":").trim()
      : "";

  const subjectSnapshot = {
    id: String(record.subject_profile_id),
    personnelId: String(subject?.personnel_id ?? ""),
    displayName: String(subject?.display_name ?? "Restricted personnel"),
    rank: String(subject?.rank ?? ""),
    callSign: subject?.call_sign ? String(subject.call_sign) : null,
  };

  const authorSnapshot = {
    id: String(record.author_profile_id),
    personnelId: String(author?.personnel_id ?? ""),
    displayName: String(author?.display_name ?? "Department personnel"),
    rank: String(author?.rank ?? ""),
    callSign: author?.call_sign ? String(author.call_sign) : null,
  };

  return (
    <PortalShell
      active="guardians"
      eyebrow={`Guardian G-${String(record.guardian_number).padStart(4, "0")}`}
      title={record.title}
      description={`${record.reference_number} · ${record.record_type} · ${record.status}`}
      actions={(
        <>
          <Link className="portal-button portal-button--secondary" href="/portal/command/guardians">
            Back to Guardians
          </Link>
          <Link
            className="portal-button portal-button--primary"
            href={isEvaluation ? "/portal/command/guardians/evaluations" : "/portal/command/guardians/manage"}
          >
            {isEvaluation ? "Open evaluations" : "Open management"}
          </Link>
        </>
      )}
    >
      <GuardianRecordDocument
        guardianId={String(record.id)}
        guardianNumber={String(record.guardian_number).padStart(4, "0")}
        referenceNumber={String(record.reference_number)}
        title={String(record.title ?? record.record_type)}
        recordType={String(record.record_type)}
        category={category}
        status={String(record.status)}
        incidentDate={dateTime(record.incident_at)}
        issuedDate={record.issued_at
          ? dateTime(record.issued_at)
          : record.status === "Draft"
            ? "Not issued"
            : dateTime(record.created_at)}
        location={String(record.location ?? "")}
        policyReference={String(record.policy_reference ?? "")}
        relatedReference={String(fields.reference ?? "")}
        pointsAssessed={Number(record.points_assessed ?? 0)}
        observedConduct={String(record.observed_behavior ?? "")}
        operationalImpact={String(fields.impact ?? "")}
        expectedStandard={String(record.expected_standard ?? "")}
        supervisorContext={String(fields.context ?? "")}
        followUpPlan={String(record.follow_up_plan ?? "")}
        followUpDate={record.follow_up_due_at ? dateTime(record.follow_up_due_at) : ""}
        responseWindow={String(fields.response_window ?? "")}
        allowResponse={fields.allow_response !== false}
        memberResponse={String(record.employee_response ?? acknowledgment?.response_text ?? "")}
        acknowledgedAt={record.acknowledged_at ? dateTime(record.acknowledged_at) : ""}
        subject={subjectSnapshot}
        author={authorSnapshot}
        acknowledgment={acknowledgment ? {
          fingerprintId: String(acknowledgment.fingerprint_id ?? ""),
          typedName: acknowledgment.typed_name ? String(acknowledgment.typed_name) : null,
          signatureMethod: String(acknowledgment.signature_method ?? "Digital acknowledgment"),
          acknowledgmentText: String(acknowledgment.acknowledgment_text ?? ""),
          displayNameSnapshot: String(acknowledgment.display_name_snapshot ?? subjectSnapshot.displayName),
          rankSnapshot: String(acknowledgment.rank_snapshot ?? subjectSnapshot.rank),
          personnelIdSnapshot: String(acknowledgment.personnel_id_snapshot ?? subjectSnapshot.personnelId),
          callSignSnapshot: acknowledgment.call_sign_snapshot ? String(acknowledgment.call_sign_snapshot) : null,
          responseText: acknowledgment.response_text ? String(acknowledgment.response_text) : null,
          signedAt: dateTime(acknowledgment.signed_at),
        } : null}
        evaluation={isEvaluation ? {
          kind: String(fields.evaluation_kind ?? "Performance"),
          periodStart: dateOnly(fields.period_start),
          periodEnd: dateOnly(fields.period_end),
          overallAverage: Number(fields.overall_average ?? 0).toFixed(2),
          overallRating: String(fields.overall_rating ?? "Not rated"),
          ratings: ratingEntries,
          supervisorSummary: String(fields.supervisor_summary ?? record.observed_behavior ?? ""),
          strengths: String(fields.strengths ?? record.action_taken ?? ""),
          improvementAreas: String(fields.improvement_areas ?? record.expected_standard ?? ""),
          goals: String(fields.goals ?? record.follow_up_plan ?? ""),
          remediationRequired: fields.remediation_required === true,
          remediationPlan: String(fields.remediation_plan ?? ""),
        } : null}
      />
    </PortalShell>
  );
}
