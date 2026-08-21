import Link from "next/link";
import { redirect } from "next/navigation";
import { CommandApprovalQueue, type CommandApprovalItem } from "../../_components/CommandApprovalQueue";
import { LeaveApprovalQueue } from "../../_components/LeaveApprovalQueue";
import { PortalShell } from "../../_components/PortalShell";
import { getCurrentPortalProfile } from "@/lib/supabase/portal-profile";
import { createClient } from "@/lib/supabase/server";

export default async function ApprovalsPage() {
  const profile = await getCurrentPortalProfile();
  if (!profile || !["Executive", "Command"].includes(profile.access_tier)) redirect("/portal/command/guardians");
  const supabase = await createClient();
  const [{ data: profiles }, { data: guardians }, { data: requests }, { data: leave }, { data: certificationRequests }] = await Promise.all([
    supabase.from("personnel_profiles").select("id,display_name"),
    supabase.from("guardian_records").select("id,guardian_number,record_type,status,subject_profile_id,author_profile_id,created_at,follow_up_due_at").eq("status", "Pending Approval").order("created_at", { ascending: false }),
    supabase.from("personnel_requests").select("id,request_number,request_type,details,requested_effective_at,status,requester_profile_id,created_at").in("status", ["Submitted", "In Review"]).order("created_at", { ascending: false }),
    supabase.from("leave_requests").select("id,request_number,profile_id,leave_type,starts_on,expected_return_on,notes,status").in("status", ["Submitted", "In Review"]).order("created_at", { ascending: false }),
    supabase.from("certifications").select("id,profile_id,name,status,notes,created_at").in("status", ["Requested", "Pending"]).order("created_at", { ascending: false }),
  ]);
  const names = new Map((profiles ?? []).map((item) => [item.id, item.display_name]));
  const items: CommandApprovalItem[] = [
    ...(guardians ?? []).map((record) => ({ databaseId: record.id, id: `G-${String(record.guardian_number).padStart(4, "0")}`, kind: "Guardian" as const, type: record.record_type, subject: names.get(record.subject_profile_id) ?? "Restricted personnel", submittedBy: names.get(record.author_profile_id) ?? "Supervisor", priority: ["Written Warning", "Write-Up"].includes(record.record_type) ? "High" : "Review", age: new Date(record.created_at).toLocaleDateString(), details: "Open the Guardian Center for the complete attributed record.", effectiveDate: record.follow_up_due_at ? new Date(record.follow_up_due_at).toLocaleDateString() : "Not specified" })),
    ...(requests ?? []).map((request) => ({ databaseId: request.id, id: `RQ-${String(request.request_number).padStart(4, "0")}`, kind: "Request" as const, type: request.request_type, subject: names.get(request.requester_profile_id) ?? "Personnel", submittedBy: "Self-service", priority: "Routine", age: new Date(request.created_at).toLocaleDateString(), details: request.details, effectiveDate: request.requested_effective_at ? new Date(request.requested_effective_at).toLocaleDateString() : "Not specified" })),
  ];
  const leaveItems = (leave ?? []).map((item) => ({ id: item.id, request_number: Number(item.request_number), display_name: names.get(item.profile_id) ?? "Personnel", leave_type: item.leave_type, starts_on: item.starts_on, expected_return_on: item.expected_return_on, notes: item.notes, status: item.status }));

  return (
    <PortalShell active="approvals" eyebrow="Command decision center" title="Approvals" description="A dedicated review queue for personnel actions that require Command authority.">
      <section className="portal-metric-grid">
        <article className="portal-metric portal-metric--gold"><span>Guardian & personnel</span><strong>{String(items.length).padStart(2, "0")}</strong><small>Awaiting Command review</small></article>
        <article className="portal-metric portal-metric--warning"><span>Leave requests</span><strong>{String(leaveItems.length).padStart(2, "0")}</strong><small>LOA decisions pending</small></article>
        <article className="portal-metric portal-metric--neutral"><span>Certification requests</span><strong>{String(certificationRequests?.length ?? 0).padStart(2, "0")}</strong><small><Link href="/portal/command/certifications">Open Certification Center</Link></small></article>
      </section>
      <section className="portal-panel"><div className="portal-panel-heading"><div><p>Guardians & personnel</p><h2>Decision queue</h2></div><span>{items.length} pending</span></div><CommandApprovalQueue initialItems={items} /></section>
      <section className="portal-panel"><div className="portal-panel-heading"><div><p>Leave administration</p><h2>LOA requests</h2></div><span>{leaveItems.length} pending</span></div><LeaveApprovalQueue items={leaveItems} /></section>
      <section className="portal-panel"><div className="portal-panel-heading"><div><p>Professional standards</p><h2>Certification requests</h2></div><Link href="/portal/command/certifications">Review & issue certifications →</Link></div><div className="deputy-request-history">{(certificationRequests ?? []).map((item) => <article key={item.id}><span>CE</span><div><strong>{item.name}</strong><small>{names.get(item.profile_id) ?? "Personnel"} · {item.notes ?? "No request note"}</small></div><b>{item.status}</b></article>)}{!(certificationRequests ?? []).length ? <div className="portal-empty-state"><strong>No certification requests are awaiting review.</strong></div> : null}</div></section>
    </PortalShell>
  );
}
