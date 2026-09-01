import Link from "next/link";
import { redirect } from "next/navigation";
import { CommandApprovalQueue, type CommandApprovalItem } from "../../_components/CommandApprovalQueue";
import { LeaveApprovalQueue } from "../../_components/LeaveApprovalQueue";
import { PortalShell } from "../../_components/PortalShell";
import { loadPersonnelPurview } from "@/lib/authorization/load-personnel-purview";
import { getCurrentPortalProfile } from "@/lib/supabase/portal-profile";
import { createClient } from "@/lib/supabase/server";

const DEPARTMENT_COMMAND_RANKS = new Set(["Sheriff", "Undersheriff", "Major", "Captain"]);
const REVIEW_TIERS = new Set(["Executive", "Command", "Supervisor", "Preliminary"]);

export default async function ApprovalsPage() {
  const profile = await getCurrentPortalProfile();
  if (!profile || !REVIEW_TIERS.has(profile.access_tier)) redirect("/portal/my-office");

  const supabase = await createClient() as any;
  const fullCommandAccess = ["Executive", "Command"].includes(profile.access_tier);
  const [{ data: profiles }, guardiansResult, requestsResult, leaveResult, certificationRequestsResult] = await Promise.all([
    supabase.from("personnel_profiles").select("id,display_name"),
    fullCommandAccess
      ? supabase.from("guardian_records").select("id,guardian_number,record_type,status,subject_profile_id,author_profile_id,created_at,follow_up_due_at").eq("status", "Pending Approval").order("created_at", { ascending: false })
      : Promise.resolve({ data: [] }),
    supabase.from("personnel_requests").select("id,request_number,request_type,details,requested_effective_at,status,requester_profile_id,created_at,subject,current_reviewer_profile_id,current_reviewer_label,routing_fallback,routing_stage,routing_label,requested_unit_id").in("status", ["Submitted", "In Review"]).order("created_at", { ascending: false }),
    fullCommandAccess
      ? supabase.from("leave_requests").select("id,request_number,profile_id,leave_type,starts_on,expected_return_on,notes,status,created_at").in("status", ["Submitted", "In Review"]).order("created_at", { ascending: false })
      : Promise.resolve({ data: [] }),
    fullCommandAccess
      ? supabase.from("certifications").select("id,profile_id,name,status,notes,created_at").in("status", ["Requested", "Pending"]).order("created_at", { ascending: false })
      : Promise.resolve({ data: [] }),
  ]);

  const departmentAuthority = DEPARTMENT_COMMAND_RANKS.has(profile.rank);
  const purview = fullCommandAccess && !departmentAuthority ? await loadPersonnelPurview(profile) : null;
  const scopedIds = new Set((purview?.rows ?? []).map((row) => row.profileId));
  const allowed = (profileId: string | null | undefined) => departmentAuthority || Boolean(profileId && scopedIds.has(profileId));
  const allowedDecision = (profileId: string | null | undefined) => Boolean(profileId && profileId !== profile.id && allowed(profileId));

  const guardians = fullCommandAccess ? (guardiansResult.data ?? []).filter((row: any) => allowedDecision(row.subject_profile_id)) : [];
  const requests = (requestsResult.data ?? []).filter((row: any) => {
    if (row.requester_profile_id === profile.id) return false;
    if (row.current_reviewer_profile_id === profile.id) return true;
    return Boolean(row.routing_fallback && ["Sheriff", "Undersheriff"].includes(profile.rank));
  });
  const leave = fullCommandAccess ? (leaveResult.data ?? []).filter((row: any) => allowedDecision(row.profile_id)) : [];
  const certificationRequests = fullCommandAccess ? (certificationRequestsResult.data ?? []).filter((row: any) => allowedDecision(row.profile_id)) : [];

  const names = new Map((profiles ?? []).map((item: any) => [item.id, item.display_name]));
  const guardianItems: CommandApprovalItem[] = guardians.map((record: any) => ({
    databaseId: record.id,
    id: `G-${String(record.guardian_number).padStart(4, "0")}`,
    kind: "Guardian" as const,
    type: record.record_type,
    subject: names.get(record.subject_profile_id) ?? "Restricted personnel",
    submittedBy: names.get(record.author_profile_id) ?? "Supervisor",
    priority: ["Written Warning", "Write-Up"].includes(record.record_type) ? "High" : "Review",
    age: new Date(record.created_at).toLocaleDateString(),
    details: "Open the Guardian Center for the complete attributed record.",
    effectiveDate: record.follow_up_due_at ? new Date(record.follow_up_due_at).toLocaleDateString() : "Not specified",
  }));

  const requestItems: CommandApprovalItem[] = requests.map((request: any) => ({
    databaseId: request.id,
    id: `RQ-${String(request.request_number).padStart(4, "0")}`,
    kind: "Request" as const,
    type: request.request_type,
    subject: names.get(request.requester_profile_id) ?? "Personnel",
    submittedBy: request.routing_label ? `${request.routing_label} · Self-service` : "Self-service",
    priority: request.routing_fallback ? "High" : "Routine",
    age: new Date(request.created_at).toLocaleDateString(),
    details: request.details || request.subject || "Personnel request",
    effectiveDate: request.requested_effective_at ? new Date(request.requested_effective_at).toLocaleDateString() : "Not specified",
    routingLabel: request.routing_label ?? request.routing_stage ?? "Assigned review",
  }));

  const leaveItems = leave.map((item: any) => ({ id: item.id, request_number: Number(item.request_number), display_name: names.get(item.profile_id) ?? "Personnel", leave_type: item.leave_type, starts_on: item.starts_on, expected_return_on: item.expected_return_on, notes: item.notes, status: item.status }));
  const scopeUnavailable = fullCommandAccess && !departmentAuthority && !purview?.structuredAuthorityAvailable;

  return (
    <PortalShell active="approvals" eyebrow="Decision center" title="Approvals" description="Only matters currently routed to your authority appear here." actions={<Link className="portal-button portal-button--secondary" href="/portal/notifications#action-required">Action Center</Link>}>
      {scopeUnavailable ? <div className="command-v2-inline-state"><strong>Structured purview is not active yet.</strong><span>No department-wide approvals are inferred from legacy supervisor labels.</span></div> : null}

      <section className="portal-metric-grid">
        <article className="portal-metric portal-metric--neutral"><span>Personnel requests</span><strong>{String(requestItems.length).padStart(2, "0")}</strong><small>Routed directly to you</small></article>
        {fullCommandAccess ? <article className="portal-metric portal-metric--gold"><span>Guardian approvals</span><strong>{String(guardianItems.length).padStart(2, "0")}</strong><small>Awaiting review</small></article> : null}
        {fullCommandAccess ? <article className="portal-metric portal-metric--warning"><span>Leave requests</span><strong>{String(leaveItems.length).padStart(2, "0")}</strong><small>LOA decisions pending</small></article> : null}
        {fullCommandAccess ? <article className="portal-metric portal-metric--neutral"><span>Certification requests</span><strong>{String(certificationRequests.length).padStart(2, "0")}</strong><small>Issue or deny</small></article> : null}
      </section>

      <section className="portal-panel" id="personnel-requests">
        <div className="portal-panel-heading"><div><p>Personnel routing</p><h2>Requests assigned to you</h2></div><span>{requestItems.length} pending</span></div>
        <CommandApprovalQueue initialItems={requestItems} />
      </section>

      {fullCommandAccess ? (
        <>
          <section className="portal-panel" id="guardian-requests">
            <div className="portal-panel-heading"><div><p>Guardians</p><h2>Guardian approvals</h2></div><span>{guardianItems.length} pending</span></div>
            <CommandApprovalQueue initialItems={guardianItems} />
          </section>

          <section className="portal-panel" id="leave-requests">
            <div className="portal-panel-heading"><div><p>Leave administration</p><h2>LOA requests</h2></div><span>{leaveItems.length} pending</span></div>
            <LeaveApprovalQueue items={leaveItems} />
          </section>

          <section className="portal-panel" id="certification-requests">
            <div className="portal-panel-heading"><div><p>Professional standards</p><h2>Certification requests</h2></div><Link href="/portal/command/certifications">Review & issue certifications →</Link></div>
            <div className="deputy-request-history">
              {certificationRequests.map((item: any) => <article key={item.id}><span>CE</span><div><strong>{item.name}</strong><small>{names.get(item.profile_id) ?? "Personnel"} · {item.notes ?? "No request note"}</small></div><b>{item.status}</b></article>)}
              {!certificationRequests.length ? <div className="portal-empty-state"><strong>No certification requests are awaiting review.</strong></div> : null}
            </div>
          </section>
        </>
      ) : null}
    </PortalShell>
  );
}
