import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { PortalShell } from "../../../_components/PortalShell";
import { createClient } from "@/lib/supabase/server";
import { getCurrentPortalProfile } from "@/lib/supabase/portal-profile";

type PersonnelRecordPageProps = {
  params: Promise<{ personnelId: string }>;
};

export default async function PersonnelRecordPage({ params }: PersonnelRecordPageProps) {
  const profile = await getCurrentPortalProfile();
  if (!profile || !["Executive", "Command"].includes(profile.access_tier)) {
    redirect("/portal/command/supervision");
  }

  const { personnelId } = await params;
  const supabase = await createClient() as any;
  const { data: member } = await supabase
    .from("personnel_profiles")
    .select("id,personnel_id,display_name,rank,call_sign,division,supervisor_label,status,access_tier")
    .eq("personnel_id", personnelId.toUpperCase())
    .maybeSingle();

  if (!member) notFound();

  const [{ count: certifications }, { count: guardians }, { count: awards }, { count: flags }] = await Promise.all([
    supabase.from("certifications").select("id", { count: "exact", head: true }).eq("profile_id", member.id).eq("status", "Current"),
    supabase.from("guardian_records").select("id", { count: "exact", head: true }).eq("subject_profile_id", member.id),
    supabase.from("personnel_awards").select("id", { count: "exact", head: true }).eq("profile_id", member.id),
    supabase.from("personnel_flags").select("id", { count: "exact", head: true }).eq("profile_id", member.id).eq("active", true),
  ]);

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
        <div className="deputy-profile-facts"><div><span>Division</span><strong>{member.division}</strong></div><div><span>Chain of command</span><strong>{member.supervisor_label}</strong></div><div><span>Status</span><strong>{member.status}</strong></div><div><span>Access</span><strong>{member.access_tier}</strong></div></div>
      </section>

      <nav className="command-v2-record-tabs" aria-label="Personnel record sections">
        <span className="is-active">Overview</span>
        <span>Timeline</span>
        <span>Supervision</span>
        <span>Training</span>
        <span>Recognition</span>
        <span>Documents</span>
        <span>Administration</span>
      </nav>

      <div className="deputy-summary-grid command-v2-record-metrics">
        <article><span>Certifications</span><strong>{String(certifications ?? 0).padStart(2, "0")}</strong><small>Current</small></article>
        <article><span>Guardians</span><strong>{String(guardians ?? 0).padStart(2, "0")}</strong><small>Total record</small></article>
        <article><span>Medals</span><strong>{String(awards ?? 0).padStart(2, "0")}</strong><small>Permanent decorations</small></article>
        <article><span>Active flags</span><strong>{String(flags ?? 0).padStart(2, "0")}</strong><small>Administrative</small></article>
      </div>

      <div className="command-v2-workspace-grid">
        <section className="portal-panel command-v2-launcher">
          <div className="portal-panel-heading"><div><p>Personnel</p><h2>Service record</h2></div></div>
          <p className="command-v2-compact-copy">Awards, flags, and permanent personnel actions.</p>
          <div className="command-v2-action-row"><Link className="portal-button portal-button--secondary" href="/portal/command/service-records">Open service records</Link></div>
        </section>
        <section className="portal-panel command-v2-launcher">
          <div className="portal-panel-heading"><div><p>Accountability</p><h2>Guardians</h2></div></div>
          <p className="command-v2-compact-copy">Review or create authorized Guardian records.</p>
          <div className="command-v2-action-row"><Link className="portal-button portal-button--secondary" href="/portal/command/guardians">Guardian Center</Link></div>
        </section>
        <section className="portal-panel command-v2-launcher">
          <div className="portal-panel-heading"><div><p>Training</p><h2>Qualifications</h2></div></div>
          <p className="command-v2-compact-copy">Certification and training actions.</p>
          <div className="command-v2-action-row"><Link className="portal-button portal-button--secondary" href="/portal/command/certifications">Certification Center</Link></div>
        </section>
      </div>
    </PortalShell>
  );
}
