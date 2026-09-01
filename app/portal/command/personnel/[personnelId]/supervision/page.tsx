import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { PersonnelRecordHeader } from "../../../../_components/PersonnelRecordHeader";
import { PortalShell } from "../../../../_components/PortalShell";
import { canAccessPersonnelRecord } from "@/lib/authorization/can-access-personnel-record";
import { createClient } from "@/lib/supabase/server";
import { getCurrentPortalProfile } from "@/lib/supabase/portal-profile";

type PageProps = { params: Promise<{ personnelId: string }> };

export default async function PersonnelSupervisionPage({ params }: PageProps) {
  const profile = await getCurrentPortalProfile();
  if (!profile) redirect("/portal/login");
  const { personnelId } = await params;
  const access = await canAccessPersonnelRecord(profile, personnelId);
  if (!access.allowed) redirect("/portal/command/supervision");

  const supabase = await createClient() as any;
  const { data: member } = await supabase.from("personnel_profiles").select("id,personnel_id,display_name,rank,call_sign,division,supervisor_label,status").eq("personnel_id", personnelId.toUpperCase()).maybeSingle();
  if (!member) notFound();

  const [guardians, points] = await Promise.all([
    supabase.from("guardian_records").select("id,guardian_number,record_type,status,title,incident_at,created_at,points_assessed").eq("subject_profile_id", member.id).order("created_at", { ascending: false }),
    supabase.from("disciplinary_point_events").select("id,event_type,delta,reason,effective_on,created_at").eq("profile_id", member.id).order("created_at", { ascending: false }),
  ]);

  const focusedGuardianHref = `/portal/command/guardians?q=${encodeURIComponent(member.personnel_id)}`;

  return (
    <PortalShell active="personnel" eyebrow={`${member.personnel_id} · Supervision`} title={`${member.display_name} · Supervision`} description="Guardian history, accountability, and supervisory context." actions={<Link className="portal-button portal-button--secondary" href={`/portal/command/personnel/${member.personnel_id}`}>Back to record</Link>}>
      <PersonnelRecordHeader personnelId={member.personnel_id} displayName={member.display_name} rank={member.rank} callSign={member.call_sign} assignment={member.division} status={member.status} active="supervision" />
      <section className="portal-panel" style={{ marginBottom: 16 }}>
        <div className="portal-panel-heading"><div><p>Chain of command</p><h2>Who supervises this record?</h2></div></div>
        <div className="command-v2-inline-state"><strong>{member.supervisor_label || "No supervisor label recorded"}</strong><span>Access to this record is controlled by the member&apos;s current organizational assignment and formal supervisory authority.</span></div>
      </section>
      <div className="personnel-record-two-column">
        <section className="portal-panel">
          <div className="portal-panel-heading"><div><p>Accountability</p><h2>Guardian history</h2></div><span>{guardians.data?.length ?? 0}</span></div>
          <div className="command-v2-mini-list">
            {(guardians.data ?? []).length ? (guardians.data ?? []).map((item:any) => <Link key={item.id} href={`/portal/command/guardians/${item.guardian_number}`}><div><strong>G-{String(item.guardian_number).padStart(4, "0")} · {item.record_type}</strong><span>{item.title} · {item.status}{item.points_assessed ? ` · ${item.points_assessed} pts` : ""}</span></div></Link>) : <p className="command-v2-compact-copy">No Guardian records.</p>}
          </div>
        </section>
        <section className="portal-panel">
          <div className="portal-panel-heading"><div><p>Disciplinary record</p><h2>Point events</h2></div><span>{points.data?.length ?? 0}</span></div>
          <div className="command-v2-mini-list">
            {(points.data ?? []).length ? (points.data ?? []).map((item:any) => <div key={item.id}><strong>{item.event_type} · {item.delta > 0 ? `+${item.delta}` : item.delta}</strong><span>{item.reason}</span></div>) : <p className="command-v2-compact-copy">No disciplinary point events.</p>}
          </div>
        </section>
        <section className="portal-panel command-v2-launcher">
          <div className="portal-panel-heading"><div><p>Workflow</p><h2>Guardian Center</h2></div></div>
          <p className="command-v2-compact-copy">Open Guardian records already filtered to this employee instead of searching for them again.</p>
          <div className="command-v2-action-row"><Link className="portal-button portal-button--secondary" href={focusedGuardianHref}>Open this employee&apos;s Guardians</Link></div>
        </section>
      </div>
    </PortalShell>
  );
}
