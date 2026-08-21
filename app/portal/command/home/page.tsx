import Link from "next/link";
import { redirect } from "next/navigation";
import { PortalShell } from "../../_components/PortalShell";
import { createClient } from "@/lib/supabase/server";
import { getCurrentPortalProfile } from "@/lib/supabase/portal-profile";

export default async function CommandHomePage() {
  const profile = await getCurrentPortalProfile();
  if (!profile || !["Executive", "Command"].includes(profile.access_tier)) {
    redirect("/portal/command/supervision");
  }

  const supabase = await createClient() as any;
  const now = new Date();
  const thirtyDays = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

  const [profilesResult, guardiansResult, certificationsResult, requestsResult, leaveResult] = await Promise.all([
    supabase.from("personnel_profiles").select("id,status,is_test_account"),
    supabase.from("guardian_records").select("id,status,follow_up_due_at,created_at,guardian_number,title").order("created_at", { ascending: false }),
    supabase.from("certifications").select("id,status,expires_on"),
    supabase.from("personnel_requests").select("id,status,request_type,subject,created_at").order("created_at", { ascending: false }),
    supabase.from("leave_requests").select("id,status,profile_id,starts_on,expected_return_on,created_at").order("created_at", { ascending: false }),
  ]);

  const personnel = profilesResult.data ?? [];
  const guardians = guardiansResult.data ?? [];
  const certifications = certificationsResult.data ?? [];
  const requests = requestsResult.data ?? [];
  const leave = leaveResult.data ?? [];

  const activePersonnel = personnel.filter((item:any) => ["Active", "Acting"].includes(item.status) && !item.is_test_account).length;
  const pendingGuardians = guardians.filter((item:any) => item.status === "Pending Approval");
  const pendingRequests = requests.filter((item:any) => ["Submitted", "In Review"].includes(item.status));
  const pendingLeave = leave.filter((item:any) => ["Submitted", "In Review"].includes(item.status));
  const followUps = guardians.filter((item:any) => item.follow_up_due_at && new Date(item.follow_up_due_at) <= now && !["Acknowledged", "Closed"].includes(item.status));
  const expiring = certifications.filter((item:any) => item.status === "Current" && item.expires_on && new Date(item.expires_on) <= thirtyDays);
  const attentionTotal = pendingGuardians.length + pendingRequests.length + pendingLeave.length + followUps.length;

  return (
    <PortalShell
      active="overview"
      eyebrow="Command"
      title="Home"
      description="Current department priorities and quick access."
    >
      <div className="deputy-summary-grid command-v2-home-metrics">
        <article><span>Active personnel</span><strong>{String(activePersonnel).padStart(2, "0")}</strong><small>Department personnel</small></article>
        <article><span>Needs attention</span><strong>{String(attentionTotal).padStart(2, "0")}</strong><small>Approvals and follow-ups</small></article>
        <article><span>Expiring certs</span><strong>{String(expiring.length).padStart(2, "0")}</strong><small>Next 30 days</small></article>
        <article><span>Active LOA review</span><strong>{String(pendingLeave.length).padStart(2, "0")}</strong><small>Awaiting action</small></article>
      </div>

      <div className="command-v2-home-layout">
        <section className="portal-panel command-v2-home-attention">
          <div className="portal-panel-heading"><div><p>Priority</p><h2>Needs attention</h2></div><Link href="/portal/command/approvals">View all</Link></div>
          <div className="command-v2-mini-list">
            {pendingGuardians.slice(0, 3).map((item:any) => <Link href={`/portal/command/guardians/${item.guardian_number}`} key={`g-${item.id}`}><strong>G-{String(item.guardian_number).padStart(4, "0")} · {item.title}</strong><span>Pending approval</span></Link>)}
            {pendingRequests.slice(0, 2).map((item:any) => <Link href="/portal/command/approvals" key={`r-${item.id}`}><strong>{item.subject}</strong><span>{item.request_type} · {item.status}</span></Link>)}
            {followUps.slice(0, 2).map((item:any) => <Link href={`/portal/command/guardians/${item.guardian_number}`} key={`f-${item.id}`}><strong>G-{String(item.guardian_number).padStart(4, "0")} · Follow-up due</strong><span>{item.title}</span></Link>)}
            {!attentionTotal ? <div className="portal-empty-state"><strong>No command items require attention.</strong></div> : null}
          </div>
        </section>

        <aside className="command-v2-home-shortcuts">
          <Link href="/portal/command/personnel"><span>Personnel</span><strong>Find a personnel record</strong></Link>
          <Link href="/portal/command/supervision"><span>Supervision</span><strong>Guardians and oversight</strong></Link>
          <Link href="/portal/command/training"><span>Training</span><strong>Certifications and FTO</strong></Link>
          <Link href="/portal/command/administration"><span>Administration</span><strong>Approvals and audit</strong></Link>
          <Link href="/portal/command"><span>Current system</span><strong>Open full legacy overview</strong></Link>
        </aside>
      </div>
    </PortalShell>
  );
}
