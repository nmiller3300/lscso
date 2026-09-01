import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { PersonnelRecordHeader } from "../../../../_components/PersonnelRecordHeader";
import { PortalShell } from "../../../../_components/PortalShell";
import { canAccessPersonnelRecord } from "@/lib/authorization/can-access-personnel-record";
import { createClient } from "@/lib/supabase/server";
import { getCurrentPortalProfile } from "@/lib/supabase/portal-profile";

type PageProps = { params: Promise<{ personnelId: string }> };

export default async function PersonnelRecognitionPage({ params }: PageProps) {
  const profile = await getCurrentPortalProfile();
  if (!profile) redirect("/portal/login");
  const { personnelId } = await params;
  const access = await canAccessPersonnelRecord(profile, personnelId);
  if (!access.allowed) redirect("/portal/command/supervision");

  const supabase = await createClient() as any;
  const { data: member } = await supabase.from("personnel_profiles").select("id,personnel_id,display_name,rank,call_sign,division,status").eq("personnel_id", personnelId.toUpperCase()).maybeSingle();
  if (!member) notFound();

  const [awards, points, commendations] = await Promise.all([
    supabase.from("personnel_awards").select("id,award_name,citation,awarded_on,created_at").eq("profile_id", member.id).order("created_at", { ascending: false }),
    supabase.from("disciplinary_point_events").select("id,event_type,delta,reason,effective_on,created_at").eq("profile_id", member.id).lt("delta", 0).order("created_at", { ascending: false }),
    supabase.from("guardian_records").select("id,guardian_number,title,status,incident_at,acknowledged_at").eq("subject_profile_id", member.id).eq("record_type", "Commendation").order("created_at", { ascending: false }),
  ]);

  return (
    <PortalShell active="personnel" eyebrow={`${member.personnel_id} · Recognition`} title={`${member.display_name} · Recognition`} description="Awards, commendations, and positive service history." actions={<Link className="portal-button portal-button--secondary" href={`/portal/command/personnel/${member.personnel_id}`}>Back to record</Link>}>
      <PersonnelRecordHeader personnelId={member.personnel_id} displayName={member.display_name} rank={member.rank} callSign={member.call_sign} assignment={member.division} status={member.status} active="recognition" />
      <div className="personnel-record-two-column">
        <section className="portal-panel">
          <div className="portal-panel-heading"><div><p>Decorations</p><h2>Medals & awards</h2></div><span>{awards.data?.length ?? 0}</span></div>
          <div className="command-v2-mini-list">
            {(awards.data ?? []).length ? (awards.data ?? []).map((item:any) => <div key={item.id}><strong>{item.award_name}</strong><span>{item.awarded_on ? new Date(`${item.awarded_on}T12:00:00`).toLocaleDateString() : "Recorded award"}</span>{item.citation ? <small>{item.citation}</small> : null}</div>) : <p className="command-v2-compact-copy">No medals or awards recorded.</p>}
          </div>
        </section>
        <section className="portal-panel">
          <div className="portal-panel-heading"><div><p>Commendations</p><h2>Guardian commendations</h2></div><span>{commendations.data?.length ?? 0}</span></div>
          <div className="command-v2-mini-list">
            {(commendations.data ?? []).length ? (commendations.data ?? []).map((item:any) => <Link key={item.id} href={`/portal/command/guardians/${item.guardian_number}`}><div><strong>G-{String(item.guardian_number).padStart(4, "0")} · {item.title}</strong><span>{item.status}{item.acknowledged_at ? ` · Acknowledged ${new Date(item.acknowledged_at).toLocaleDateString()}` : " · Awaiting acknowledgment"}</span></div></Link>) : <p className="command-v2-compact-copy">No Guardian commendations recorded.</p>}
          </div>
        </section>
        <section className="portal-panel">
          <div className="portal-panel-heading"><div><p>Positive record</p><h2>Point restoration & commendation events</h2></div><span>{points.data?.length ?? 0}</span></div>
          <div className="command-v2-mini-list">
            {(points.data ?? []).length ? (points.data ?? []).map((item:any) => <div key={item.id}><strong>{item.event_type} · {item.delta}</strong><span>{item.reason}</span></div>) : <p className="command-v2-compact-copy">No positive point events recorded.</p>}
          </div>
        </section>
        <section className="portal-panel command-v2-launcher">
          <div className="portal-panel-heading"><div><p>Department recognition</p><h2>Awards management</h2></div></div>
          <p className="command-v2-compact-copy">Recognition actions remain controlled through the existing awards workflow.</p>
          <div className="command-v2-action-row"><Link className="portal-button portal-button--secondary" href="/portal/command/awards">Open awards</Link></div>
        </section>
      </div>
    </PortalShell>
  );
}
