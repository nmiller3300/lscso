import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { PersonnelRecordHeader } from "../../../_components/PersonnelRecordHeader";
import { PersonnelRecordUtilities } from "../../../_components/PersonnelRecordUtilities";
import { PortalShell } from "../../../_components/PortalShell";
import { createClient } from "@/lib/supabase/server";
import { getCurrentPortalProfile } from "@/lib/supabase/portal-profile";
import { canAccessPersonnelRecord } from "@/lib/authorization/can-access-personnel-record";

type PersonnelRecordPageProps = {
  params: Promise<{ personnelId: string }>;
};

const ACTIVE_TRAINING_STATUSES = ["Not Started", "In Progress", "Needs Improvement"];

function shortDate(value: string | null | undefined) {
  if (!value) return null;
  return new Date(value.length === 10 ? `${value}T12:00:00` : value).toLocaleDateString();
}

export default async function PersonnelRecordPage({ params }: PersonnelRecordPageProps) {
  const profile = await getCurrentPortalProfile();
  if (!profile) redirect("/portal/login");

  const { personnelId } = await params;
  const access = await canAccessPersonnelRecord(profile, personnelId);
  if (!access.allowed) redirect("/portal/command/supervision");

  const supabase = await createClient() as any;
  const { data: member } = await supabase
    .from("personnel_profiles")
    .select("id,personnel_id,display_name,rank,call_sign,division,supervisor_label,status,access_tier")
    .eq("personnel_id", personnelId.toUpperCase())
    .maybeSingle();

  if (!member) notFound();

  const today = new Date().toISOString().slice(0, 10);

  const [
    { count: certifications },
    { count: guardians },
    { count: awards },
    { count: flags },
    assignments,
    ftoCertification,
    delegations,
    currentLeave,
    { count: activeTrainees },
    latestCareer,
  ] = await Promise.all([
    supabase.from("certifications").select("id", { count: "exact", head: true }).eq("profile_id", member.id).eq("status", "Current"),
    supabase.from("guardian_records").select("id", { count: "exact", head: true }).eq("subject_profile_id", member.id),
    supabase.from("personnel_awards").select("id", { count: "exact", head: true }).eq("profile_id", member.id),
    supabase.from("personnel_flags").select("id", { count: "exact", head: true }).eq("profile_id", member.id).eq("active", true),
    supabase.from("personnel_unit_assignments")
      .select("id,assignment_type,starts_at,ends_at,notes,organizational_units(id,name,unit_type)")
      .eq("profile_id", member.id)
      .is("ends_at", null)
      .order("starts_at", { ascending: true }),
    supabase.from("certifications")
      .select("id,expires_on")
      .eq("profile_id", member.id)
      .eq("name", "Field Training Officer")
      .eq("status", "Current")
      .or(`expires_on.is.null,expires_on.gte.${today}`)
      .limit(1),
    supabase.from("personnel_delegations")
      .select("id,delegation_type,expires_at,organizational_units(name)")
      .eq("profile_id", member.id)
      .is("revoked_at", null)
      .lte("starts_at", new Date().toISOString())
      .or(`expires_at.is.null,expires_at.gt.${new Date().toISOString()}`)
      .order("created_at", { ascending: true }),
    supabase.from("leave_requests")
      .select("id,leave_type,starts_on,expected_return_on")
      .eq("profile_id", member.id)
      .eq("status", "Approved")
      .lte("starts_on", today)
      .gte("expected_return_on", today)
      .limit(1),
    supabase.from("training_progress")
      .select("id", { count: "exact", head: true })
      .eq("evaluator_profile_id", member.id)
      .in("status", ACTIVE_TRAINING_STATUSES),
    supabase.from("personnel_career_events")
      .select("event_type,title,effective_at")
      .eq("profile_id", member.id)
      .order("effective_at", { ascending: false })
      .limit(1),
  ]);

  const activeAssignments = assignments.data ?? [];
  const guardianHref = `/portal/command/guardians?q=${encodeURIComponent(member.personnel_id)}`;
  const primaryAssignment = activeAssignments.find((assignment:any) => assignment.assignment_type === "Primary");
  const primaryUnitName = primaryAssignment?.organizational_units?.name ?? member.division;
  const activeDelegations = delegations.data ?? [];
  const leaveRow = currentLeave.data?.[0];
  const ftoQualified = Boolean(ftoCertification.data?.length);
  const displayStatus = member.status === "Suspended" ? "Suspended" : leaveRow ? "LOA" : member.status;
  const latestCareerRow = latestCareer.data?.[0];

  return (
    <PortalShell
      active="personnel"
      eyebrow={`${member.personnel_id} · ${member.call_sign ?? "No call sign"}`}
      title={member.display_name}
      description={`${member.rank} · ${primaryUnitName}`}
      actions={<Link className="portal-button portal-button--secondary" href="/portal/command/personnel">Back to Personnel</Link>}
    >
      <PersonnelRecordHeader personnelId={member.personnel_id} displayName={member.display_name} rank={member.rank} callSign={member.call_sign} assignment={primaryUnitName} status={displayStatus} active="overview" />
      <PersonnelRecordUtilities personnelId={member.personnel_id} displayName={member.display_name} />

      <div className="deputy-summary-grid command-v2-record-metrics">
        <article><span>Certifications</span><strong>{String(certifications ?? 0).padStart(2, "0")}</strong><small>Current</small></article>
        <article><span>Guardians</span><strong>{String(guardians ?? 0).padStart(2, "0")}</strong><small>Total record</small></article>
        <article><span>Medals</span><strong>{String(awards ?? 0).padStart(2, "0")}</strong><small>Permanent decorations</small></article>
        <article><span>Active flags</span><strong>{String(flags ?? 0).padStart(2, "0")}</strong><small>Administrative</small></article>
      </div>

      <section className="portal-panel" style={{ marginBottom: 16 }}>
        <div className="portal-panel-heading"><div><p>Role communication</p><h2>Authority & operational role</h2></div><span>{activeDelegations.length} delegated</span></div>
        <div className="command-v2-workspace-grid">
          <div className="portal-panel">
            <div className="portal-panel-heading"><div><p>Standing authority</p><h2>{member.access_tier}</h2></div></div>
            <p className="command-v2-compact-copy">Baseline authority follows the member&apos;s current rank. Additional responsibility is granted through named delegation rather than raw permission toggles.</p>
          </div>
          <div className="portal-panel">
            <div className="portal-panel-heading"><div><p>FTO permissions</p><h2>{ftoQualified ? "Authorized" : "Not authorized"}</h2></div><span>{activeTrainees ?? 0} trainees</span></div>
            <p className="command-v2-compact-copy">{ftoQualified ? "This member holds a current Field Training Officer certification and has FTO permissions for trainees assigned to them." : "No current Field Training Officer certification is recorded, so this member has no FTO permissions."}</p>
          </div>
          <div className="portal-panel">
            <div className="portal-panel-heading"><div><p>Operational status</p><h2>{displayStatus}</h2></div></div>
            <p className="command-v2-compact-copy">{leaveRow ? `${leaveRow.leave_type} through ${shortDate(leaveRow.expected_return_on)}` : "No current approved leave changes this member&apos;s displayed operational status."}</p>
          </div>
        </div>

        {activeDelegations.length ? (
          <div className="command-v2-assignment-chips" style={{ marginTop: 14 }}>
            {activeDelegations.map((delegation:any) => {
              const unit = Array.isArray(delegation.organizational_units) ? delegation.organizational_units[0] : delegation.organizational_units;
              return (
                <div key={delegation.id}>
                  <strong>{delegation.delegation_type}</strong>
                  <span>{unit?.name ? `${unit.name} · ` : ""}{delegation.expires_at ? `Expires ${shortDate(delegation.expires_at)}` : "No expiration"}</span>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="command-v2-inline-state" style={{ marginTop: 14 }}><strong>No active delegated authority.</strong><span>This member is currently operating only under standing rank, assignment, qualification, and direct supervisory authority.</span></div>
        )}
      </section>

      <section className="portal-panel command-v2-record-assignments">
        <div className="portal-panel-heading"><div><p>Current service</p><h2>Divisions & assignments</h2></div><Link href={`/portal/command/personnel/${member.personnel_id}/administration#assignments`}>Manage assignments</Link></div>
        {activeAssignments.length ? (
          <div className="command-v2-assignment-chips">
            {activeAssignments.map((assignment:any) => (
              <div key={assignment.id}>
                <strong>{assignment.organizational_units?.name ?? "Unknown unit"}</strong>
                <span>{assignment.assignment_type}{assignment.organizational_units?.unit_type ? ` · ${assignment.organizational_units.unit_type}` : ""}{assignment.starts_at ? ` · since ${new Date(assignment.starts_at).toLocaleDateString()}` : ""}</span>
              </div>
            ))}
          </div>
        ) : (
          <div className="command-v2-inline-state"><strong>No active organizational assignments are recorded.</strong><span>Personnel Operations can assign this member to one or more organizational units.</span></div>
        )}
      </section>

      <div className="command-v2-workspace-grid">
        <section className="portal-panel command-v2-launcher">
          <div className="portal-panel-heading"><div><p>History</p><h2>Personnel timeline</h2></div>{latestCareerRow ? <span>{latestCareerRow.event_type}</span> : null}</div>
          <p className="command-v2-compact-copy">{latestCareerRow ? `Latest: ${latestCareerRow.title} · ${shortDate(latestCareerRow.effective_at)}` : "Career, training, recognition, accountability, and administrative history in one chronological view."}</p>
          <div className="command-v2-action-row"><Link className="portal-button portal-button--primary" href={`/portal/command/personnel/${member.personnel_id}/timeline`}>Open timeline</Link></div>
        </section>
        <section className="portal-panel command-v2-launcher">
          <div className="portal-panel-heading"><div><p>Accountability</p><h2>Guardians</h2></div></div>
          <p className="command-v2-compact-copy">Open Guardian records already focused on this employee.</p>
          <div className="command-v2-action-row"><Link className="portal-button portal-button--secondary" href={guardianHref}>Open Guardians</Link></div>
        </section>
        <section className="portal-panel command-v2-launcher">
          <div className="portal-panel-heading"><div><p>Training</p><h2>Qualifications</h2></div></div>
          <p className="command-v2-compact-copy">Review this employee&apos;s training, FTO assignment, and certification history.</p>
          <div className="command-v2-action-row"><Link className="portal-button portal-button--secondary" href={`/portal/command/personnel/${member.personnel_id}/training`}>Open training record</Link></div>
        </section>
      </div>
    </PortalShell>
  );
}
