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
  if (!profile || !["Executive", "Command"].includes(profile.access_tier)) {
    redirect("/portal/command/supervision");
  }

  const supabase = await createClient() as any;
  const now = new Date();
  const thirtyDays = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

  const [profilesResult, guardiansResult, certificationsResult, requestsResult, leaveResult, applicationsResult] = await Promise.all([
    supabase.from("personnel_profiles").select("id,status,is_test_account"),
    supabase.from("guardian_records").select("id,status,subject_profile_id,follow_up_due_at,created_at,guardian_number,title").order("created_at", { ascending: false }),
    supabase.from("certifications").select("id,profile_id,status,expires_on"),
    supabase.from("personnel_requests").select("id,requester_profile_id,status,request_type,subject,created_at,current_reviewer_profile_id,current_reviewer_label,routing_fallback,routing_stage,routing_label").order("created_at", { ascending: false }),
    supabase.from("leave_requests").select("id,status,profile_id,starts_on,expected_return_on,created_at").order("created_at", { ascending: false }),
    supabase.from("recruitment_applications").select("id,application_number,full_name,discord_username,status,submitted_at").order("submitted_at", { ascending: false }).limit(100),
  ]);

  const departmentAuthority = DEPARTMENT_COMMAND_RANKS.has(profile.rank);
  const purview = departmentAuthority ? null : await loadPersonnelPurview(profile);
  const scopedIds = new Set((purview?.rows ?? []).map((row) => row.profileId));
  const allowed = (profileId: string | null | undefined) => departmentAuthority || Boolean(profileId && scopedIds.has(profileId));
  const allowedDecision = (profileId: string | null | undefined) => Boolean(profileId && profileId !== profile.id && allowed(profileId));
  const scopeUnavailable = !departmentAuthority && !purview?.structuredAuthorityAvailable;

  const allProfiles = profilesResult.data ?? [];
  const personnel = departmentAuthority ? allProfiles : allProfiles.filter((item:any) => allowedDecision(item.id));
  const guardians = guardiansResult.data ?? [];
  const certifications = certificationsResult.data ?? [];
  const requests = requestsResult.data ?? [];
  const leave = leaveResult.data ?? [];
  const applications = applicationsResult.data ?? [];

  const activePersonnel = personnel.filter((item:any) => ["Active", "Acting"].includes(item.status) && !item.is_test_account).length;
  const pendingGuardians = guardians.filter((item:any) => allowedDecision(item.subject_profile_id) && item.status === "Pending Approval");
  const pendingRequests = requests.filter((item:any) => {
    if (!["Submitted", "In Review"].includes(item.status) || item.requester_profile_id === profile.id) return false;
    if (item.current_reviewer_profile_id === profile.id) return true;
    return Boolean(item.routing_fallback && !item.current_reviewer_profile_id && EXECUTIVE_FALLBACK_RANKS.has(profile.rank));
  });
  const pendingLeave = leave.filter((item:any) => allowedDecision(item.profile_id) && ["Submitted", "In Review"].includes(item.status));
  const pendingCertifications = certifications.filter((item:any) => allowedDecision(item.profile_id) && ["Requested", "Pending"].includes(item.status));
  const pendingApplications = applications.filter((item:any) => item.status === "Submitted");
  const followUps = guardians.filter((item:any) => allowedDecision(item.subject_profile_id) && item.follow_up_due_at && new Date(item.follow_up_due_at) <= now && !["Acknowledged", "Closed"].includes(item.status));
  const expiring = certifications.filter((item:any) => allowedDecision(item.profile_id) && item.status === "Current" && item.expires_on && new Date(item.expires_on) <= thirtyDays);
  const attentionTotal = pendingGuardians.length + pendingRequests.length + pendingLeave.length + pendingCertifications.length + pendingApplications.length + followUps.length;

  return (
    <PortalShell
      active="overview"
      eyebrow="Command"
      title="Home"
      description="What needs attention, who is in the department, and the most common Command tasks."
      actions={<Link className="portal-button portal-button--primary" href="/portal/notifications#action-required">Open Action Center</Link>}
    >
      {scopeUnavailable ? <div className="command-v2-inline-state"><strong>Your assigned command scope is not active yet.</strong><span>Ask Executive Command to assign your personnel or organizational responsibility before making personnel decisions.</span></div> : null}

      <div className="deputy-summary-grid command-v2-home-metrics">
        <article><span>Active personnel</span><strong>{String(activePersonnel).padStart(2, "0")}</strong><small>{departmentAuthority ? "Department personnel" : "Within your responsibility"}</small></article>
        <article><span>Needs attention</span><strong>{String(attentionTotal).padStart(2, "0")}</strong><small>Items actually waiting on you</small></article>
        <article><span>New applications</span><strong>{String(pendingApplications.length).padStart(2, "0")}</strong><small>Awaiting initial review</small></article>
        <article><span>Expiring certs</span><strong>{String(expiring.length).padStart(2, "0")}</strong><small>Within 30 days</small></article>
        <article><span>Open requests</span><strong>{String(pendingRequests.length + pendingLeave.length + pendingCertifications.length).padStart(2, "0")}</strong><small>Routed personnel, LOA & certification</small></article>
      </div>

      <section className="portal-panel command-v2-common-tasks">
        <div className="portal-panel-heading"><div><p>Common tasks</p><h2>What do you need to do?</h2></div><span>Direct links</span></div>
        <div className="command-v2-task-grid">
          <Link href="/portal/command/applications"><span>Recruitment</span><strong>Review applications</strong><small>Open signed applications, assign reviewers, schedule interviews, and record decisions.</small></Link>
          <Link href="/portal/command/personnel"><span>Personnel</span><strong>Find a member</strong><small>Open their full personnel record.</small></Link>
          <Link href="/portal/command/personnel/roster"><span>Roster</span><strong>Open the full roster</strong><small>Accounts, rank, status, callsigns, and department roster.</small></Link>
          <Link href="/portal/command/guardians"><span>Supervision</span><strong>Find or create a Guardian</strong><small>Warnings, feedback, write-ups, and commendations.</small></Link>
          <Link href="/portal/command/approvals"><span>Decisions</span><strong>Review pending requests</strong><small>Only work currently routed to your authority appears for decision.</small></Link>
          <Link href="/portal/command/training"><span>Training</span><strong>Training & FTO</strong><small>Trainees, FTOs, progress, and readiness.</small></Link>
          <Link href="/portal/command/certifications"><span>Qualifications</span><strong>Manage certifications</strong><small>Issue, review, and monitor certifications.</small></Link>
        </div>
      </section>

      <div className="command-v2-home-layout">
        <section className="portal-panel command-v2-home-attention">
          <div className="portal-panel-heading"><div><p>Priority</p><h2>Action required</h2></div><Link href="/portal/notifications#action-required">View all</Link></div>

          <div className="command-v2-attention-summary" aria-label="Pending Command work by category">
            <Link href="/portal/command/applications"><strong>{String(pendingApplications.length).padStart(2, "0")}</strong><span>New applications</span></Link>
            <Link href="/portal/command/approvals#guardian-requests"><strong>{String(pendingGuardians.length).padStart(2, "0")}</strong><span>Guardian approvals</span></Link>
            <Link href="/portal/command/approvals#personnel-requests"><strong>{String(pendingRequests.length).padStart(2, "0")}</strong><span>Routed requests</span></Link>
            <Link href="/portal/command/approvals#leave-requests"><strong>{String(pendingLeave.length).padStart(2, "0")}</strong><span>LOA requests</span></Link>
            <Link href="/portal/command/approvals#certification-requests"><strong>{String(pendingCertifications.length).padStart(2, "0")}</strong><span>Certification requests</span></Link>
          </div>

          <div className="command-v2-mini-list">
            {pendingApplications.slice(0, 3).map((item:any) => <Link href={`/portal/command/applications/${item.id}`} key={`a-${item.id}`}><strong>{applicationLabel(item.application_number)} · {item.full_name}</strong><span>{item.discord_username} · New application</span></Link>)}
            {pendingGuardians.slice(0, 3).map((item:any) => <Link href={`/portal/command/guardians/${item.guardian_number}`} key={`g-${item.id}`}><strong>G-{String(item.guardian_number).padStart(4, "0")} · {item.title}</strong><span>Pending approval</span></Link>)}
            {pendingRequests.slice(0, 2).map((item:any) => <Link href="/portal/command/approvals#personnel-requests" key={`r-${item.id}`}><strong>{item.subject}</strong><span>{item.request_type} · {item.routing_label ?? item.routing_stage ?? item.status}</span></Link>)}
            {followUps.slice(0, 2).map((item:any) => <Link href={`/portal/command/guardians/${item.guardian_number}`} key={`f-${item.id}`}><strong>G-{String(item.guardian_number).padStart(4, "0")} · Follow-up due</strong><span>{item.title}</span></Link>)}
            {!attentionTotal ? <div className="portal-empty-state"><strong>Nothing requires Command action right now.</strong></div> : null}
          </div>
        </section>

        <aside className="command-v2-home-shortcuts">
          <Link href="/portal/command/applications"><span>Recruitment</span><strong>Applications & hiring review</strong></Link>
          <Link href="/portal/notifications"><span>Inbox</span><strong>Notifications & action items</strong></Link>
          <Link href="/portal/command/supervision"><span>Supervision</span><strong>Personnel oversight & Guardians</strong></Link>
          <Link href="/portal/command/administration"><span>Administration</span><strong>Approvals, audit & department tools</strong></Link>
          {profile.access_tier === "Executive" ? <Link href="/portal/command/administration/structure"><span>Department structure</span><strong>Units, assignments & authority</strong></Link> : null}
          <Link href="/portal/my-office"><span>My Info</span><strong>My record, requests & certifications</strong></Link>
        </aside>
      </div>
    </PortalShell>
  );
}
