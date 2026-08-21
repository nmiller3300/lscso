import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { PersonnelRecordTabs } from "../../../../_components/PersonnelRecordTabs";
import { PortalShell } from "../../../../_components/PortalShell";
import { createClient } from "@/lib/supabase/server";
import { getCurrentPortalProfile } from "@/lib/supabase/portal-profile";

type PageProps = { params: Promise<{ personnelId: string }> };

export default async function PersonnelSupervisionPage({ params }: PageProps) {
  const profile = await getCurrentPortalProfile();
  if (!profile || !["Executive", "Command"].includes(profile.access_tier)) redirect("/portal/command/supervision");
  const { personnelId } = await params;
  const supabase = await createClient() as any;
  const { data: member } = await supabase.from("personnel_profiles").select("id,personnel_id,display_name,rank,division,supervisor_label,status").eq("personnel_id", personnelId.toUpperCase()).maybeSingle();
  if (!member) notFound();

  const [guardians, points] = await Promise.all([
    supabase.from("guardian_records").select("id,guardian_number,record_type,status,title,incident_at,created_at,points_assessed").eq("subject_profile_id", member.id).order("created_at", { ascending: false }),
    supabase.from("disciplinary_point_events").select("id,event_type,delta,reason,effective_on,created_at").eq("profile_id", member.id).order("created_at", { ascending: false }),
  ]);

  return (
    <PortalShell active="personnel" eyebrow={`${member.personnel_id} · Supervision`} title={`${member.display_name} · Supervision`} description="Guardian history, accountability, and supervisory context." actions={<Link className="portal-button portal-button--secondary" href={`/portal/command/personnel/${member.personnel_id}`}>Back to record</Link>}>
      <PersonnelRecordTabs personnelId={member.personnel_id} active="supervision" />
      <section className="portal-panel" style={{ marginBottom: 16 }}>
        <div className="portal-panel-heading"><div><p>V2 authority</p><h2>Supervisory relationship</h2></div></div>
        <div className="command-v2-inline-state"><strong>Structured purview controls authority.</strong><span>The legacy supervisor label ({member.supervisor_label || "none"}) is display-only and does not grant V2 permissions.</span></div>
      </section>
      <div className="command-v2-workspace-grid">
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
          <p className="command-v2-compact-copy">Create, review, and follow up on Guardian records through the existing authorized workflow.</p>
          <div className="command-v2-action-row"><Link className="portal-button portal-button--secondary" href="/portal/command/guardians">Open Guardian Center</Link></div>
        </section>
      </div>
    </PortalShell>
  );
}
