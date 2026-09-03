import Link from "next/link";
import { redirect } from "next/navigation";
import { PortalShell } from "../../_components/PortalShell";
import { loadPersonnelPurview } from "@/lib/authorization/load-personnel-purview";
import { createClient } from "@/lib/supabase/server";
import { getCurrentPortalProfile } from "@/lib/supabase/portal-profile";
import { applicationLabel } from "@/lib/recruitment/application";

const DEPARTMENT_COMMAND_RANKS = new Set(["Sheriff", "Undersheriff", "Major", "Captain"]);
const EXECUTIVE_FALLBACK_RANKS = new Set(["Sheriff", "Undersheriff"]);

export default async function CommandHomePage() {
  const profile = await getCurrentPortalProfile();
  if (!profile || !["Executive", "Command"].includes(profile.access_tier)) redirect("/portal/command/supervision");

  const supabase = await createClient() as any;
  const now = new Date();
  const thirtyDays = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
  const [profilesResult, guardiansResult, certificationsResult, requestsResult, leaveResult, applicationsResult] = await Promise.all([
    supabase.from("personnel_profiles").select("id,status,is_test_account"),
    supabase.from("guardian_records").select("id,status,subject_profile_id,follow_up_due_at,created_at,guardian_number,title").order("created_at", { ascending: false }),
    supabase.from("certifications").select("id,profile_id,status,expires_on"),
    supabase.from("personnel_requests").select("id,request_number,requester_profile_id,status,request_type,subject,current_reviewer_profile_id,current_reviewer_label,routing_fallback,routing_stage,routing_label,created_at").order("created_at", { ascending: false }),
    supabase.from("leave_requests").select("id,status,profile_id,starts_on,expected_return_on,created_at").order("created_at", { ascending: false }),
    supabase.from("recruitment_applications").select("id,application_number,full_name,discord_username,status,submitted_at").order("submitted_at", { ascending: false }).limit(100),
  ]);

  const dataIssues = [
    profilesResult.error ? "personnel" : null,
    guardiansResult.error ? "Guardians" : null,
    certificationsResult.error ? "certifications" : null,
    requestsResult.error ? "personnel requests" : null,
    leaveResult.error ? "leave requests" : null,
    applicationsResult.error ? "applications" : null,
  ].filter(Boolean) as string[];

  const departmentAuthority = DEPARTMENT_COMMAND_RANKS.has(profile.rank);
  const purview = departmentAuthority ? null : await loadPersonnelPurview(profile);
  const scopedIds = new Set((purview?.rows ?? []).map((row) => row.profileId));
  const allowed = (profileId: string | null | undefined) => departmentAuthority || Boolean(profileId && scopedIds.has(profileId));
  const allowedDecision = (profileId: string | null | undefined) => Boolean(profileId && profileId !== profile.id && allowed(profileId));
  const scopeUnavailable = !departmentAuthority && !purview?.structuredAuthorityAvailable;

  const personnel = (profilesResult.data ?? []).filter((item: any) => allowedDecision(item.id));
  const guardians = guardiansResult.data ?? [];
  const certifications = certificationsResult.data ?? [];
  const requests = requestsResult.data ?? [];
  const leave = leaveResult.data ?? [];
  const applications = applicationsResult.data ?? [];

  const requestNeedsMyReview = (item: any) => {
    if (!["Submitted", "In Review"].includes(item.status) || item.requester_profile_id === profile.id) return false;
    if (item.current_reviewer_profile_id === profile.id) return true;
    return Boolean(item.routing_fallback && EXECUTIVE_FALLBACK_RANKS.has(profile.rank));
  };

  const activePersonnel = personnel.filter((item: any) => ["Active", "Acting"].includes(item.status) && !item.is_test_account).length;
  const pendingGuardians = guardians.filter((item: any) => allowedDecision(item.subject_profile_id) && item.status === "Pending Approval");
  const pendingRequests = requests.filter(requestNeedsMyReview);
  const pendingLeave = leave.filter((item: any) => allowedDecision(item.profile_id) && ["Submitted", "In Review"].includes(item.status));
  const pendingCertifications = certifications.filter((item: any) => allowedDecision(item.profile_id) && ["Requested", "Pending"].includes(item.status));
  const pendingApplications = applications.filter((item: any) => item.status === "Submitted");
  const followUps = guardians.filter((item: any) => allowedDecision(item.subject_profile_id) && item.follow_up_due_at && new Date(item.follow_up_due_at) <= now && !["Acknowledged", "Closed"].includes(item.status));
  const expiring = certifications.filter((item: any) => allowedDecision(item.profile_id) && item.status === "Current" && item.expires_on && new Date(item.expires_on) <= thirtyDays);
  const attentionTotal = pendingGuardians.length + pendingRequests.length + pendingLeave.length + pendingCertifications.length + pendingApplications.length + followUps.length;
  const metric = (value: number, unavailable: boolean) => unavailable ? "—" : String(value).padStart(2, "0");

  return (
    <PortalShell active="overview" eyebrow="Command" title="Home" description="Actionable work, department standing, and the fastest path to Command operations." actions={<Link className="portal-button portal-button--primary" href="/portal/notifications#action-required">Open Action Center</Link>}>
      {dataIssues.length ? <div className="portal-data-warning" role="status"><strong>Some Command data is temporarily unavailable.</strong><span>{dataIssues.join(", ")} could not be loaded. A missing dataset is shown as — rather than being reported as zero.</span></div> : null}
      {scopeUnavailable ? <div className="command-v2-inline-state"><strong>Your assigned command scope is not active yet.</strong><span>Executive Command must assign your personnel or organizational responsibility before personnel decisions can be made.</span></div> : null}

      <div className="deputy-summary-grid command-v2-home-metrics">
        <article><span>Active personnel</span><strong>{metric(activePersonnel, Boolean(profilesResult.error))}</strong><small>Members under your command · your own profile is excluded</small></article>
        <article><span>Needs your attention</span><strong>{metric(attentionTotal, dataIssues.length > 0)}</strong><small>Only work currently routed to you</small></article>
        <article><span>New applications</span><strong>{metric(pendingApplications.length, Boolean(applicationsResult.error))}</strong><small>Awaiting initial review</small></article>
        <article><span>Expiring certs</span><strong>{metric(expiring.length, Boolean(certificationsResult.error))}</strong><small>Within 30 days</small></article>
        <article><span>Open requests</span><strong>{metric(pendingRequests.length + pendingLeave.length + pendingCertifications.length, Boolean(requestsResult.error || leaveResult.error || certificationsResult.error))}</strong><small>Personnel, LOA and certification decisions</small></article>
      </div>

      <div className="command-home-primary-grid">
        <section className="portal-panel command-v2-home-attention">
          <div className="portal-panel-heading"><div><p>Priority workspace</p><h2>Action required</h2></div><Link href="/portal/notifications#action-required">Open full queue</Link></div>
          <div className="command-v2-attention-summary" aria-label="Pending Command work by category">
            <Link href="/portal/command/applications"><strong>{metric(pendingApplications.length, Boolean(applicationsResult.error))}</strong><span>Applications</span></Link>
            <Link href="/portal/command/approvals#guardian-requests"><strong>{metric(pendingGuardians.length, Boolean(guardiansResult.error))}</strong><span>Guardians</span></Link>
            <Link href="/portal/command/approvals#personnel-requests"><strong>{metric(pendingRequests.length, Boolean(requestsResult.error))}</strong><span>Requests</span></Link>
            <Link href="/portal/command/approvals#leave-requests"><strong>{metric(pendingLeave.length, Boolean(leaveResult.error))}</strong><span>LOA</span></Link>
            <Link href="/portal/command/approvals#certification-requests"><strong>{metric(pendingCertifications.length, Boolean(certificationsResult.error))}</strong><span>Certifications</span></Link>
          </div>
          <div className="command-v2-mini-list command-home-action-list">
            {pendingApplications.slice(0, 3).map((item: any) => <Link href={`/portal/command/applications/${item.id}`} key={`a-${item.id}`}><strong>{applicationLabel(item.application_number)} · {item.full_name}</strong><span>{item.discord_username} · New application</span></Link>)}
            {pendingGuardians.slice(0, 3).map((item: any) => <Link href={`/portal/command/guardians/${item.guardian_number}`} key={`g-${item.id}`}><strong>G-{String(item.guardian_number).padStart(4, "0")} · {item.title}</strong><span>Pending approval</span></Link>)}
            {pendingRequests.slice(0, 3).map((item: any) => <Link href="/portal/command/approvals#personnel-requests" key={`r-${item.id}`}><strong>RQ-{String(item.request_number).padStart(4, "0")} · {item.subject}</strong><span>{item.request_type} · {item.routing_label ?? item.routing_stage ?? item.current_reviewer_label ?? "Assigned review"}</span></Link>)}
            {followUps.slice(0, 2).map((item: any) => <Link href={`/portal/command/guardians/${item.guardian_number}`} key={`f-${item.id}`}><strong>G-{String(item.guardian_number).padStart(4, "0")} · Follow-up due</strong><span>{item.title}</span></Link>)}
            {!attentionTotal && !dataIssues.length ? <div className="portal-empty-state"><strong>Nothing requires your action right now.</strong><span>New routed work will appear here and in the Action Center.</span></div> : null}
            {!attentionTotal && dataIssues.length ? <div className="portal-empty-state is-unavailable"><strong>Action queue cannot be confirmed yet.</strong><span>At least one supporting dataset failed to load. Refresh before relying on this queue.</span></div> : null}
          </div>
        </section>

        <aside className="portal-panel command-home-quick-actions">
          <div className="portal-panel-heading"><div><p>Quick actions</p><h2>Start work</h2></div><span>Direct</span></div>
          <nav aria-label="Command quick actions">
            <Link href="/portal/command/personnel"><span>Personnel</span><strong>Find a member</strong><b>→</b></Link>
            <Link href="/portal/command/guardians"><span>Supervision</span><strong>Create a Guardian</strong><b>→</b></Link>
            <Link href="/portal/command/applications"><span>Recruitment</span><strong>Review applications</strong><b>→</b></Link>
            <Link href="/portal/command/training"><span>Training</span><strong>Training & FTO</strong><b>→</b></Link>
            <Link href="/portal/command/administration"><span>Administration</span><strong>Department tools</strong><b>→</b></Link>
            <Link href="/portal/my-office"><span>Personal</span><strong>Open My Info</strong><b>→</b></Link>
          </nav>
        </aside>
      </div>
    </PortalShell>
  );
}
