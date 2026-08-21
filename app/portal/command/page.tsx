import Link from "next/link";
import { CommandActivity } from "../_components/CommandInteractions";
import { PortalShell } from "../_components/PortalShell";
import { rankAccess } from "../_data/model";
import { createClient } from "@/lib/supabase/server";

export default async function CommandDashboardPage() {
  const supabase = await createClient();
  const [{ data: profiles }, { data: guardians }, { data: certifications }, { data: requests }] = await Promise.all([
    supabase.from("personnel_profiles").select("id,display_name,status,is_test_account"),
    supabase.from("guardian_records").select("id,guardian_number,record_type,status,subject_profile_id,author_profile_id,created_at,follow_up_due_at").order("created_at", { ascending: false }),
    supabase.from("certifications").select("id,status,expires_on"),
    supabase.from("personnel_requests").select("id,request_number,request_type,status,requester_profile_id,created_at").order("created_at", { ascending: false }),
  ]);

  const now = new Date();
  const inThirtyDays = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
  const profileNames = new Map((profiles ?? []).map((profile) => [profile.id, profile.display_name]));
  const activePersonnel = (profiles ?? []).filter((profile) => ["Active", "Acting"].includes(profile.status) && !profile.is_test_account).length;
  const pendingGuardians = (guardians ?? []).filter((record) => record.status === "Pending Approval");
  const pendingRequests = (requests ?? []).filter((request) => ["Submitted", "In Review"].includes(request.status));
  const expiring = (certifications ?? []).filter((certification) => certification.status === "Current" && certification.expires_on && new Date(certification.expires_on) <= inThirtyDays).length;
  const overdue = (guardians ?? []).filter((record) => record.follow_up_due_at && new Date(record.follow_up_due_at) < now && !["Acknowledged", "Closed"].includes(record.status)).length;

  const metrics = [
    { value: String(activePersonnel).padStart(2, "0"), label: "Active personnel", detail: "Official accounts only", tone: "neutral" },
    { value: String(pendingGuardians.length + pendingRequests.length).padStart(2, "0"), label: "Awaiting approval", detail: `${pendingGuardians.length} Guardian records`, tone: "gold" },
    { value: String(expiring).padStart(2, "0"), label: "Certifications expiring", detail: "Within 30 days", tone: "warning" },
    { value: String(overdue).padStart(2, "0"), label: "Overdue follow-ups", detail: "Supervisor response due", tone: "danger" },
  ];

  const approvalQueue = [
    ...pendingGuardians.map((record) => ({
      id: `G-${String(record.guardian_number).padStart(4, "0")}`,
      type: record.record_type,
      subject: profileNames.get(record.subject_profile_id) ?? "Restricted personnel",
      submittedBy: profileNames.get(record.author_profile_id) ?? "Command",
      priority: ["Written Warning", "Write-Up"].includes(record.record_type) ? "High" : "Review",
      age: new Date(record.created_at).toLocaleDateString(),
    })),
    ...pendingRequests.map((request) => ({
      id: `RQ-${String(request.request_number).padStart(4, "0")}`,
      type: request.request_type,
      subject: profileNames.get(request.requester_profile_id) ?? "Restricted personnel",
      submittedBy: "Self-service",
      priority: "Routine",
      age: new Date(request.created_at).toLocaleDateString(),
    })),
  ];

  const notifications = [
    ...(guardians ?? []).slice(0, 3).map((record) => ({
      time: new Date(record.created_at).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }),
      title: `${record.record_type} ${record.status.toLowerCase()}`,
      detail: `G-${String(record.guardian_number).padStart(4, "0")} · ${profileNames.get(record.subject_profile_id) ?? "Restricted personnel"}`,
      type: "Guardian",
    })),
    ...(requests ?? []).slice(0, 2).map((request) => ({
      time: new Date(request.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
      title: `${request.request_type} request`,
      detail: `RQ-${String(request.request_number).padStart(4, "0")} · ${profileNames.get(request.requester_profile_id) ?? "Restricted personnel"}`,
      type: "Request",
    })),
  ];
  return (
    <PortalShell
      active="overview"
      eyebrow={new Intl.DateTimeFormat("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" }).format(now)}
      title="Command overview"
      description="Personnel readiness, pending decisions, and department accountability in one view."
      actions={
        <>
          <Link className="portal-button portal-button--secondary" href="/portal/command/personnel">
            View roster
          </Link>
          <Link className="portal-button portal-button--primary" href="/portal/command/guardians">
            Create Guardian
          </Link>
        </>
      }
    >
      <section className="portal-metric-grid" aria-label="Command dashboard metrics">
        {metrics.map((metric) => (
          <article className={`portal-metric portal-metric--${metric.tone}`} key={metric.label}>
            <span>{metric.label}</span>
            <strong>{metric.value}</strong>
            <small>{metric.detail}</small>
          </article>
        ))}
      </section>

      <div className="portal-dashboard-grid">
        <section className="portal-panel portal-panel--wide" id="approvals">
          <div className="portal-panel-heading">
            <div>
              <p>Decision queue</p>
              <h2>Awaiting command review</h2>
            </div>
            <span>{approvalQueue.length} open</span>
          </div>
          <div className="portal-approval-list">
            {approvalQueue.map((item) => (
              <article key={item.id}>
                <span className={`portal-record-type portal-record-type--${item.type.toLowerCase().replaceAll(" ", "-")}`}>
                  {item.type.slice(0, 2).toUpperCase()}
                </span>
                <div className="portal-approval-id">
                  <strong>{item.id}</strong>
                  <span>{item.type}</span>
                </div>
                <div>
                  <strong>{item.subject}</strong>
                  <span>{item.submittedBy}</span>
                </div>
                <span className={`portal-priority portal-priority--${item.priority.toLowerCase()}`}>
                  {item.priority}
                </span>
                <small>{item.age}</small>
                <Link href={item.id.startsWith("G-") ? "/portal/command/guardians" : "/portal/command#certifications"}>
                  Review →
                </Link>
              </article>
            ))}
            {approvalQueue.length === 0 ? (
              <div className="portal-empty-state"><strong>No command approvals are waiting.</strong></div>
            ) : null}
          </div>
        </section>

        <CommandActivity notifications={notifications} />
      </div>

      <section className="portal-quick-section">
        <div className="portal-section-heading">
          <div>
            <p>Command tools</p>
            <h2>Start an action</h2>
          </div>
          <span>Actions remain permission-scoped and auditable.</span>
        </div>
        <div className="portal-quick-grid">
          <Link href="/portal/command/personnel">
            <span>01</span>
            <strong>Create personnel account</strong>
            <p>Assign a username, rank, division, access tier, and temporary password.</p>
            <b>Open roster →</b>
          </Link>
          <Link href="/portal/command/guardians">
            <span>02</span>
            <strong>Begin a Guardian</strong>
            <p>Use an organized, type-specific form for feedback, warnings, write-ups, or commendations.</p>
            <b>Open Guardian Center →</b>
          </Link>
          <Link href="/portal/command#certifications" id="certifications">
            <span>03</span>
            <strong>Review certification request</strong>
            <p>Approve additions, monitor expiration dates, and preserve supporting documentation.</p>
            <b>Review requests →</b>
          </Link>
          <Link href="/portal/command#training" id="training">
            <span>04</span>
            <strong>Update Academy or FTO</strong>
            <p>Track phases, evaluations, remedial plans, sign-offs, and release readiness.</p>
            <b>Open training →</b>
          </Link>
        </div>
      </section>

      <section className="portal-access-section">
        <div className="portal-section-heading">
          <div>
            <p>Approved permissions</p>
            <h2>Rank-based access model</h2>
          </div>
          <span>Acting-supervisor grants automatically expire and never elevate account-deactivation authority.</span>
        </div>
        <div className="portal-access-grid">
          {rankAccess.map((group) => (
            <article key={group.tier}>
              <span>{group.tier}</span>
              <strong>{group.ranks.join(" · ")}</strong>
              <p>{group.scope}</p>
            </article>
          ))}
        </div>
      </section>
    </PortalShell>
  );
}
