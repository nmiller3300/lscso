import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { PersonnelRecordTabs } from "../../../../_components/PersonnelRecordTabs";
import { PortalShell } from "../../../../_components/PortalShell";
import { canAccessPersonnelRecord } from "@/lib/authorization/can-access-personnel-record";
import { createClient } from "@/lib/supabase/server";
import { getCurrentPortalProfile } from "@/lib/supabase/portal-profile";

type PageProps = { params: Promise<{ personnelId: string }> };

export default async function PersonnelTrainingPage({ params }: PageProps) {
  const profile = await getCurrentPortalProfile();
  if (!profile) redirect("/portal/login");
  const { personnelId } = await params;
  const access = await canAccessPersonnelRecord(profile, personnelId);
  if (!access.allowed) redirect("/portal/command/supervision");

  const supabase = await createClient() as any;
  const { data: member } = await supabase.from("personnel_profiles").select("id,personnel_id,display_name,rank,division").eq("personnel_id", personnelId.toUpperCase()).maybeSingle();
  if (!member) notFound();

  const [certs, training] = await Promise.all([
    supabase.from("certifications").select("id,name,certificate_number,status,issued_on,expires_on").eq("profile_id", member.id).order("issued_on", { ascending: false }),
    supabase.from("training_progress").select("id,program_type,phase,status,started_on,completed_on,evaluation_notes").eq("profile_id", member.id).order("created_at", { ascending: false }),
  ]);

  return (
    <PortalShell active="personnel" eyebrow={`${member.personnel_id} · Training`} title={`${member.display_name} · Training`} description="Qualifications, certifications, and training progression." actions={<Link className="portal-button portal-button--secondary" href={`/portal/command/personnel/${member.personnel_id}`}>Back to record</Link>}>
      <PersonnelRecordTabs personnelId={member.personnel_id} active="training" />
      <div className="command-v2-workspace-grid">
        <section className="portal-panel">
          <div className="portal-panel-heading"><div><p>Qualifications</p><h2>Certifications</h2></div><span>{certs.data?.length ?? 0}</span></div>
          <div className="command-v2-mini-list">
            {(certs.data ?? []).length ? (certs.data ?? []).map((item:any) => <div key={item.id}><strong>{item.name}</strong><span>{item.certificate_number ?? "Pending number"} · {item.status}{item.expires_on ? ` · Expires ${new Date(`${item.expires_on}T12:00:00`).toLocaleDateString()}` : ""}</span></div>) : <p className="command-v2-compact-copy">No certification records.</p>}
          </div>
        </section>
        <section className="portal-panel">
          <div className="portal-panel-heading"><div><p>Progression</p><h2>Training records</h2></div><span>{training.data?.length ?? 0}</span></div>
          <div className="command-v2-mini-list">
            {(training.data ?? []).length ? (training.data ?? []).map((item:any) => <div key={item.id}><strong>{item.program_type} · {item.phase}</strong><span>{item.status}{item.completed_on ? ` · Completed ${new Date(`${item.completed_on}T12:00:00`).toLocaleDateString()}` : ""}</span>{item.evaluation_notes ? <small>{item.evaluation_notes}</small> : null}</div>) : <p className="command-v2-compact-copy">No training progression records.</p>}
          </div>
        </section>
        <section className="portal-panel command-v2-launcher">
          <div className="portal-panel-heading"><div><p>Management</p><h2>Certification Center</h2></div></div>
          <p className="command-v2-compact-copy">Issue, review, or manage qualifications through the existing certification workflow.</p>
          <div className="command-v2-action-row"><Link className="portal-button portal-button--secondary" href="/portal/command/certifications">Open Certification Center</Link></div>
        </section>
      </div>
    </PortalShell>
  );
}
