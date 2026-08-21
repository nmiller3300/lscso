import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { PersonnelRecordTabs } from "../../../_components/PersonnelRecordTabs";
import { PortalShell } from "../../../_components/PortalShell";
import { createClient } from "@/lib/supabase/server";
import { getCurrentPortalProfile } from "@/lib/supabase/portal-profile";
import { canAccessPersonnelRecord } from "@/lib/authorization/can-access-personnel-record";

type PersonnelRecordPageProps = {
  params: Promise<{ personnelId: string }>;
};

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

  const [{ count: certifications }, { count: guardians }, { count: awards }, { count: flags }, assignments] = await Promise.all([
    supabase.from("certifications").select("id", { count: "exact", head: true }).eq("profile_id", member.id).eq("status", "Current"),
    supabase.from("guardian_records").select("id", { count: "exact", head: true }).eq("subject_profile_id", member.id),
    supabase.from("personnel_awards").select("id", { count: "exact", head: true }).eq("profile_id", member.id),
    supabase.from("personnel_flags").select("id", { count: "exact", head: true }).eq("profile_id", member.id).eq("active", true),
    supabase.from("division_assignments")
      .select("id,division,assignment_type,effective_at,ends_at,notes")
      .eq("profile_id", member.id)
      .is("ends_at", null)
      .order("effective_at", { ascending: true }),
  ]);

  const activeAssignments = assignments.data ?? [];
  const guardianHref = `/portal/command/guardians?q=${encodeURIComponent(member.personnel_id)}`;

  return (
    <PortalShell
      active="personnel"
      eyebrow={`${member.personnel_id} · ${member.call_sign ?? "No call sign"}`}
      title={member.display_name}
      description={`${member.rank} · ${member.division}`}
      actions={<Link className="portal-button portal-button--secondary" href="/portal/command/personnel">Back to Personnel</Link>}
    >
      <section className="deputy-profile-card command-v2-record-header">
        <div className="deputy-profile-identity"><span>{member.display_name.split(/\s+/).map((part:string)=>part[0]).join("").slice(0,2).toUpperCase()}</span><div><small>Personnel record</small><h2>{member.display_name}</h2><p>{member.rank} · {member.call_sign ?? "No call sign"} · {member.personnel_id}</p></div></div>
        <div className="deputy-profile-facts"><div><span>Legacy division</span><strong>{member.division}</strong></div><div><span>Legacy supervisor</span><strong>{member.supervisor_label}</strong></div><div><span>Status</span><strong>{member.status}</strong></div><div><span>Access</span><strong>{member.access_tier}</strong></div></div>
      </section>

      <PersonnelRecordTabs personnelId={member.personnel_id} active="overview" />

      <div className="deputy-summary-grid command-v2-record-metrics">
        <article><span>Certifications</span><strong>{String(certifications ?? 0).padStart(2, "0")}</strong><small>Current</small></article>
        <article><span>Guardians</span><strong>{String(guardians ?? 0).padStart(2, "0")}</strong><small>Total record</small></article>
        <article><span>Medals</span><strong>{String(awards ?? 0).padStart(2, "0")}</strong><small>Permanent decorations</small></article>
        <article><span>Active flags</span><strong>{String(flags ?? 0).padStart(2, "0")}</strong><small>Administrative</small></article>
      </div>

      <section className="portal-panel command-v2-record-assignments">
        <div className="portal-panel-heading"><div><p>Current service</p><h2>Active assignments</h2></div><span>{activeAssignments.length}</span></div>
        {activeAssignments.length ? (
          <div className="command-v2-assignment-chips">
            {activeAssignments.map((assignment:any) => (
              <div key={assignment.id}>
                <strong>{assignment.division}</strong>
                <span>{assignment.assignment_type}{assignment.effective_at ? ` · since ${new Date(assignment.effective_at).toLocaleDateString()}` : ""}</span>
              </div>
            ))}
          </div>
        ) : (
          <div className="command-v2-inline-state"><strong>No structured active assignments are recorded yet.</strong><span>The legacy division above remains reference-only until V2 assignments are activated.</span></div>
        )}
      </section>

      <div className="command-v2-workspace-grid">
        <section className="portal-panel command-v2-launcher">
          <div className="portal-panel-heading"><div><p>History</p><h2>Personnel timeline</h2></div></div>
          <p className="command-v2-compact-copy">Career, training, recognition, accountability, and administrative history in one chronological view.</p>
          <div className="command-v2-action-row"><Link className="portal-button portal-button--primary" href={`/portal/command/personnel/${member.personnel_id}/timeline`}>Open timeline</Link></div>
        </section>
        <section className="portal-panel command-v2-launcher">
          <div className="portal-panel-heading"><div><p>Accountability</p><h2>Guardians</h2></div></div>
          <p className="command-v2-compact-copy">Open Guardian records already focused on this employee.</p>
          <div className="command-v2-action-row"><Link className="portal-button portal-button--secondary" href={guardianHref}>Open Guardians</Link></div>
        </section>
        <section className="portal-panel command-v2-launcher">
          <div className="portal-panel-heading"><div><p>Training</p><h2>Qualifications</h2></div></div>
          <p className="command-v2-compact-copy">Review this employee’s training and certification history.</p>
          <div className="command-v2-action-row"><Link className="portal-button portal-button--secondary" href={`/portal/command/personnel/${member.personnel_id}/training`}>Open training record</Link></div>
        </section>
      </div>
    </PortalShell>
  );
}
