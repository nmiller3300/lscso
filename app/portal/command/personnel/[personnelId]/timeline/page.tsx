import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { PersonnelTimeline, type PersonnelTimelineEvent } from "../../../../_components/PersonnelTimeline";
import { PortalShell } from "../../../../_components/PortalShell";
import { createClient } from "@/lib/supabase/server";
import { getCurrentPortalProfile } from "@/lib/supabase/portal-profile";

type TimelinePageProps = {
  params: Promise<{ personnelId: string }>;
};

function clean(value: unknown, fallback = "") {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

export default async function PersonnelTimelinePage({ params }: TimelinePageProps) {
  const profile = await getCurrentPortalProfile();
  if (!profile || !["Executive", "Command"].includes(profile.access_tier)) redirect("/portal/command/supervision");

  const { personnelId } = await params;
  const supabase = await createClient() as any;
  const { data: member } = await supabase
    .from("personnel_profiles")
    .select("id,personnel_id,display_name,rank,call_sign,division,status,created_at")
    .eq("personnel_id", personnelId.toUpperCase())
    .maybeSingle();
  if (!member) notFound();

  const [calls, divisions, certs, guardians, awards, flags, leave, training, points, requests] = await Promise.all([
    supabase.from("call_sign_assignments").select("id,call_sign,assigned_at,released_at,release_reason").eq("profile_id", member.id),
    supabase.from("division_assignments").select("id,division,assignment_type,effective_at,ends_at,notes").eq("profile_id", member.id),
    supabase.from("certifications").select("id,name,certificate_number,status,issued_on,expires_on,created_at,updated_at").eq("profile_id", member.id),
    supabase.from("guardian_records").select("id,guardian_number,record_type,status,title,incident_at,created_at,points_assessed").eq("subject_profile_id", member.id),
    supabase.from("personnel_awards").select("id,award_name,citation,awarded_on,created_at").eq("profile_id", member.id),
    supabase.from("personnel_flags").select("id,flag_type,notes,active,created_at,resolved_at").eq("profile_id", member.id),
    supabase.from("leave_requests").select("id,request_number,leave_type,starts_on,expected_return_on,status,created_at,reviewed_at").eq("profile_id", member.id),
    supabase.from("training_progress").select("id,program_type,phase,status,started_on,completed_on,evaluation_notes,created_at,updated_at").eq("profile_id", member.id),
    supabase.from("disciplinary_point_events").select("id,event_type,delta,reason,effective_on,created_at,guardian_id").eq("profile_id", member.id),
    supabase.from("personnel_requests").select("id,request_number,request_type,status,subject,details,created_at,decided_at").eq("requester_profile_id", member.id),
  ]);

  const events: PersonnelTimelineEvent[] = [];
  const add = (event: PersonnelTimelineEvent) => events.push(event);

  add({
    id: `appointment-${member.id}`,
    category: "Career",
    title: "Personnel record established",
    detail: `${member.rank} · ${member.personnel_id}${member.call_sign ? ` · ${member.call_sign}` : ""}`,
    occurredAt: member.created_at,
    status: member.status,
  });

  for (const row of calls.data ?? []) {
    add({ id: `call-${row.id}`, category: "Career", title: `Call sign ${row.call_sign} assigned`, detail: "Call sign assignment", occurredAt: row.assigned_at });
    if (row.released_at) add({ id: `call-release-${row.id}`, category: "Career", title: `Call sign ${row.call_sign} released`, detail: clean(row.release_reason, "Call sign released"), occurredAt: row.released_at });
  }

  for (const row of divisions.data ?? []) {
    add({ id: `division-${row.id}`, category: "Career", title: `${row.assignment_type} assignment · ${row.division}`, detail: clean(row.notes, "Division assignment"), occurredAt: row.effective_at });
    if (row.ends_at) add({ id: `division-end-${row.id}`, category: "Career", title: `${row.division} assignment ended`, detail: `${row.assignment_type} assignment`, occurredAt: row.ends_at });
  }

  for (const row of certs.data ?? []) {
    const occurredAt = row.issued_on ? `${row.issued_on}T12:00:00` : row.created_at;
    add({ id: `cert-${row.id}`, category: "Training", title: row.name, detail: row.certificate_number ? `Certificate ${row.certificate_number}${row.expires_on ? ` · Expires ${new Date(`${row.expires_on}T12:00:00`).toLocaleDateString()}` : " · No expiration"}` : "Certification request", occurredAt, status: row.status, href: "/portal/command/certifications" });
  }

  for (const row of guardians.data ?? []) {
    add({ id: `guardian-${row.id}`, category: "Accountability", title: `${row.record_type} · ${row.title}`, detail: `G-${String(row.guardian_number).padStart(4, "0")}${row.points_assessed ? ` · ${row.points_assessed} disciplinary point${row.points_assessed === 1 ? "" : "s"}` : ""}`, occurredAt: row.incident_at ?? row.created_at, status: row.status, href: `/portal/command/guardians/${row.guardian_number}` });
  }

  for (const row of awards.data ?? []) {
    add({ id: `award-${row.id}`, category: "Recognition", title: row.award_name, detail: clean(row.citation, "Departmental decoration"), occurredAt: row.awarded_on ? `${row.awarded_on}T12:00:00` : row.created_at });
  }

  for (const row of flags.data ?? []) {
    add({ id: `flag-${row.id}`, category: "Administrative", title: row.flag_type, detail: clean(row.notes, "Personnel flag"), occurredAt: row.created_at, status: row.active ? "Active" : "Resolved" });
    if (row.resolved_at) add({ id: `flag-resolved-${row.id}`, category: "Administrative", title: `${row.flag_type} resolved`, detail: "Personnel flag resolved", occurredAt: row.resolved_at });
  }

  for (const row of leave.data ?? []) {
    add({ id: `leave-${row.id}`, category: "Administrative", title: `${row.leave_type} leave request`, detail: `${new Date(`${row.starts_on}T12:00:00`).toLocaleDateString()} – ${new Date(`${row.expected_return_on}T12:00:00`).toLocaleDateString()} · RQ-${String(row.request_number).padStart(4, "0")}`, occurredAt: row.created_at, status: row.status });
  }

  for (const row of training.data ?? []) {
    add({ id: `training-${row.id}`, category: "Training", title: `${row.program_type} · ${row.phase}`, detail: clean(row.evaluation_notes, "Training progress record"), occurredAt: row.completed_on ? `${row.completed_on}T12:00:00` : row.started_on ? `${row.started_on}T12:00:00` : row.created_at, status: row.status });
  }

  for (const row of points.data ?? []) {
    const sign = row.delta > 0 ? `+${row.delta}` : String(row.delta);
    add({ id: `points-${row.id}`, category: row.event_type === "Outstanding Performance" || row.event_type === "Commendation Restoration" ? "Recognition" : "Accountability", title: `${row.event_type} · ${sign} point${Math.abs(row.delta) === 1 ? "" : "s"}`, detail: row.reason, occurredAt: row.effective_on ? `${row.effective_on}T12:00:00` : row.created_at });
  }

  for (const row of requests.data ?? []) {
    add({ id: `request-${row.id}`, category: "Administrative", title: `${row.request_type} request · ${row.subject}`, detail: clean(row.details, `RQ-${String(row.request_number).padStart(4, "0")}`), occurredAt: row.created_at, status: row.status });
  }

  events.sort((a, b) => new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime());

  return (
    <PortalShell
      active="personnel"
      eyebrow={`${member.personnel_id} · Personnel history`}
      title={`${member.display_name} · Timeline`}
      description="Chronological service record."
      actions={<Link className="portal-button portal-button--secondary" href={`/portal/command/personnel/${member.personnel_id}`}>Back to record</Link>}
    >
      <PersonnelTimeline events={events} />
    </PortalShell>
  );
}
