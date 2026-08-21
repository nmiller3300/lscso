import Link from "next/link";
import { DeputyGuardianRecords, DeputyRequestCenter } from "../_components/DeputyInteractions";
import { LocalGreeting } from "../_components/LocalGreeting";
import { PortalShell } from "../_components/PortalShell";
import { TestAccountBanner } from "../_components/TestAccountBanner";
import { getCurrentPortalProfile } from "@/lib/supabase/portal-profile";
import { createClient } from "@/lib/supabase/server";

function initials(name: string) {
  return name.split(/\s+/).map((part) => part[0]).join("").slice(0, 2).toUpperCase();
}

export default async function PersonnelPortalPage() {
  const profile = await getCurrentPortalProfile();
  if (!profile) return null;

  const supabase = await createClient();
  const [
    { data: certifications },
    { data: assignments },
    { data: guardians },
    { data: requests },
    { data: training },
    { data: notifications },
    { data: actingGrants },
  ] = await Promise.all([
    supabase.from("certifications").select("*").eq("profile_id", profile.id).order("created_at", { ascending: false }),
    supabase.from("division_assignments").select("*").eq("profile_id", profile.id).order("effective_at", { ascending: false }),
    supabase.from("guardian_records").select("id,status,record_type,points_assessed").eq("subject_profile_id", profile.id),
    supabase.from("personnel_requests").select("id,status").eq("requester_profile_id", profile.id),
    supabase.from("training_progress").select("*").eq("profile_id", profile.id).order("created_at"),
    supabase.from("notifications").select("*").eq("recipient_profile_id", profile.id).is("read_at", null).order("created_at", { ascending: false }).limit(4),
    supabase.from("acting_supervisor_grants").select("*").eq("profile_id", profile.id).is("revoked_at", null).gt("expires_at", new Date().toISOString()),
  ]);

  const currentCertifications = (certifications ?? []).filter((item) => item.status === "Current").length;
  const pendingCertifications = (certifications ?? []).filter((item) => ["Requested", "Pending"].includes(item.status)).length;
  const openRequests = (requests ?? []).filter((item) => !["Denied", "Cancelled", "Completed"].includes(item.status)).length;
  const currentAssignments = (assignments ?? []).filter((item) => !item.ends_at || new Date(item.ends_at) > new Date());
  const guardianCount = (guardians ?? []).length;
  const disciplinaryPoints = (guardians ?? [])
    .filter((item) => item.record_type !== "Commendation" && ["Approved", "Issued", "Awaiting Acknowledgment", "Acknowledged", "Follow-Up Due", "Closed"].includes(item.status))
    .reduce((total, item) => total + item.points_assessed, 0);

  return (
    <PortalShell
      active="record"
      audience="deputy"
      eyebrow={`${profile.is_test_account ? "Test personnel file" : "Personnel file"} · ${profile.call_sign ?? "No call sign"} · ${profile.personnel_id}`}
      title={<LocalGreeting />}
      description="Review your record, active qualifications, assignments, Guardian history, and pending requests."
      actions={<Link className="portal-button portal-button--primary" href="#requests">Start a request</Link>}
    >
      <TestAccountBanner />

      {(notifications ?? []).length ? (
        <section className="deputy-alert-row" id="notifications">
          {(notifications ?? []).map((notification, index) => (
            <article key={notification.id}>
              <span>{String(index + 1).padStart(2, "0")}</span>
              <div><strong>{notification.title}</strong><p>{notification.message}</p></div>
              <small>{new Date(notification.created_at).toLocaleDateString()}</small>
            </article>
          ))}
        </section>
      ) : <span id="notifications" />}

      <section className="deputy-profile-card">
        <div className="deputy-profile-identity">
          <span>{initials(profile.display_name)}</span>
          <div>
            <small>{profile.is_test_account ? "Test personnel" : "Department personnel"}</small>
            <h2>{profile.display_name}</h2>
            <p>{profile.rank} · {profile.call_sign ?? "No call sign"} · Personnel ID {profile.personnel_id}</p>
          </div>
        </div>
        <div className="deputy-profile-facts">
          <div><span>Primary assignment</span><strong>{profile.division}</strong></div>
          <div><span>Chain of command</span><strong>{profile.supervisor_label}</strong></div>
          <div><span>Service status</span><strong>{profile.status}</strong></div>
          <div><span>Account type</span><strong>{profile.is_test_account ? "Testing" : "Official"}</strong></div>
        </div>
        <div className="deputy-profile-seal">
          <strong>Personnel record</strong>
          <span>Live database verified</span>
        </div>
      </section>

      <section className="deputy-summary-grid">
        <article><span>Certifications</span><strong>{String(certifications?.length ?? 0).padStart(2, "0")}</strong><small>{currentCertifications} current · {pendingCertifications} pending</small></article>
        <article><span>Assigned divisions</span><strong>{String(currentAssignments.length).padStart(2, "0")}</strong><small>{currentAssignments[0]?.division ?? "None assigned"}</small></article>
        <article><span>Guardian records</span><strong>{String(guardianCount).padStart(2, "0")}</strong><small>{disciplinaryPoints} active disciplinary points</small></article>
        <article><span>Open requests</span><strong>{String(openRequests).padStart(2, "0")}</strong><small>Awaiting action</small></article>
      </section>

      <div className="deputy-content-grid">
        <section className="portal-panel deputy-certifications" id="certifications">
          <div className="portal-panel-heading"><div><p>Qualifications</p><h2>Certifications</h2></div><Link href="#requests">Request certification</Link></div>
          <div className="deputy-certification-list">
            {(certifications ?? []).map((certification) => (
              <article key={certification.id}>
                <span className={["Requested", "Pending"].includes(certification.status) ? "is-pending" : undefined} aria-hidden="true">{["Requested", "Pending"].includes(certification.status) ? "…" : "✓"}</span>
                <div><strong>{certification.name}</strong><small>{certification.issuer} · Issued {certification.issued_on ?? "Pending"}</small></div>
                <div><small>Expiration</small><strong>{certification.expires_on ?? "No expiration"}</strong></div>
                <b className={["Requested", "Pending"].includes(certification.status) ? "is-pending" : undefined}>{certification.status}</b>
              </article>
            ))}
            {(certifications ?? []).length === 0 ? <div className="portal-empty-state"><strong>No certifications are on file.</strong></div> : null}
          </div>
        </section>

        <aside className="portal-panel deputy-assignments" id="assignments">
          <div className="portal-panel-heading"><div><p>Current duty</p><h2>Assignments</h2></div></div>
          {currentAssignments.map((assignment) => (
            <article key={assignment.id}>
              <span>{assignment.assignment_type}</span>
              <strong>{assignment.division}</strong>
              <p>{assignment.notes ?? "Active assignment"}</p>
              <small>Effective {new Date(assignment.effective_at).toLocaleDateString()}</small>
            </article>
          ))}
          {currentAssignments.length === 0 ? <div className="portal-empty-state"><strong>No division assignments are on file.</strong></div> : null}
          <div className="deputy-acting-note">
            <strong>{(actingGrants ?? []).length ? "Acting-supervisor authority active" : "No active acting-supervisor authority"}</strong>
            <span>{(actingGrants ?? []).length ? `Expires ${new Date(actingGrants![0].expires_at).toLocaleString()}` : "Temporary permissions will display here with their automatic expiration time."}</span>
          </div>
        </aside>
      </div>

      <DeputyGuardianRecords records={[]} />

      <section className="deputy-progress-section">
        <div className="portal-section-heading"><div><p>Professional development</p><h2>Training progress</h2></div><span>Academy and FTO records remain part of your personnel history.</span></div>
        <div className="deputy-progress-card">
          <div>
            <span>{training?.[0]?.program_type ?? "Training record"}</span>
            <strong>{training?.[0]?.status ?? "No active program"}</strong>
            <p>{training?.[0]?.evaluation_notes ?? "Command has not assigned an Academy or FTO progress record."}</p>
          </div>
          <div className="deputy-progress-track" aria-label="Training progress">
            {(training ?? []).map((phase, index) => (
              <div className={["Complete", "Released"].includes(phase.status) ? "is-complete" : undefined} key={phase.id}><span>{index + 1}</span><strong>{phase.phase}</strong><small>{phase.status}</small></div>
            ))}
          </div>
        </div>
      </section>

      <DeputyRequestCenter />
    </PortalShell>
  );
}
