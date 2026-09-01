import Link from "next/link";
import { DeputyGuardianRecords } from "../_components/DeputyInteractions";
import { DeputyRequestCenter } from "../_components/DeputyRequestCenter";
import { DeputyNotificationCenter, type PortalNotificationItem } from "../_components/CommandInteractions";
import { DeputyCorrespondence } from "../_components/DeputyCorrespondence";
import { LeaveRequestCenter } from "../_components/LeaveRequestCenter";
import { LocalGreeting } from "../_components/LocalGreeting";
import { MedalGallery } from "../_components/MedalGallery";
import { PortalShell } from "../_components/PortalShell";
import { TestAccountBanner } from "../_components/TestAccountBanner";
import { getCurrentPortalProfile } from "@/lib/supabase/portal-profile";
import { createClient } from "@/lib/supabase/server";

function initials(name: string) {
  return name.split(/\s+/).map((part) => part[0]).join("").slice(0, 2).toUpperCase();
}

function dateLabel(value: string | null | undefined) {
  return value ? new Date(value.length === 10 ? `${value}T12:00:00` : value).toLocaleDateString() : "Not recorded";
}

export default async function PersonnelPortalPage() {
  const profile = await getCurrentPortalProfile();
  if (!profile) return null;
  const supabase = await createClient() as any;

  const [certifications, assignments, guardians, requests, training, notifications, actingGrants, awards, flags, pointEvents, disciplinaryPoints, correspondence] = await Promise.all([
    supabase.from("certifications").select("*").eq("profile_id", profile.id).order("created_at", { ascending: false }),
    supabase.from("personnel_unit_assignments").select("id,assignment_type,starts_at,notes,organizational_units(name,unit_type)").eq("profile_id", profile.id).is("ends_at", null).order("starts_at", { ascending: false }),
    supabase.from("guardian_records").select("id,status,record_type,points_assessed").eq("subject_profile_id", profile.id),
    supabase.from("personnel_requests").select("id,status").eq("requester_profile_id", profile.id),
    supabase.from("training_progress").select("*").eq("profile_id", profile.id).order("created_at"),
    supabase.from("notifications").select("id,notification_type,title,message,href,read_at,created_at").eq("recipient_profile_id", profile.id).order("created_at", { ascending: false }).limit(4),
    supabase.from("acting_supervisor_grants").select("*").eq("profile_id", profile.id).is("revoked_at", null).gt("expires_at", new Date().toISOString()),
    supabase.from("personnel_awards").select("id,award_name,citation,awarded_on,image_asset_path,awarded_by").eq("profile_id", profile.id).order("awarded_on", { ascending: false }),
    supabase.from("personnel_flags").select("id,flag_type,notes,created_at").eq("profile_id", profile.id).eq("active", true).order("created_at", { ascending: false }),
    supabase.from("disciplinary_point_events").select("id,event_type,delta,reason,effective_on,authorized_by").eq("profile_id", profile.id).order("effective_on", { ascending: false }).order("created_at", { ascending: false }),
    supabase.rpc("get_disciplinary_point_total", { target_profile_id: profile.id }),
    supabase.from("personnel_correspondence").select("id,subject,body,sent_at,author:personnel_profiles!personnel_correspondence_author_profile_id_fkey(display_name,rank)").eq("recipient_profile_id", profile.id).is("archived_at", null).order("sent_at", { ascending: false }),
  ]);

  const certificationRows = certifications.data ?? [];
  const currentCertifications = certificationRows.filter((item: any) => item.status === "Current");
  const pendingCertifications = certificationRows.filter((item: any) => ["Requested", "Pending"].includes(item.status));
  const pastCertifications = certificationRows.filter((item: any) => !["Current", "Requested", "Pending"].includes(item.status));
  const openRequests = (requests.data ?? []).filter((item: any) => !["Denied", "Cancelled", "Completed"].includes(item.status)).length;
  const commandAccess = ["Executive", "Command"].includes(profile.access_tier);
  const pendingAcknowledgments = (guardians.data ?? []).filter((item: any) => !["Acknowledged", "Closed"].includes(item.status)).length;
  const letterRows = (correspondence.data ?? []).map((item: any) => {
    const author = Array.isArray(item.author) ? item.author[0] : item.author;
    return { id: item.id, subject: item.subject, body: item.body, sentAt: item.sent_at, authorName: author?.display_name ?? "Command", authorRank: author?.rank ?? "Command" };
  });

  return (
    <PortalShell
      active="record"
      audience="deputy"
      eyebrow={`${profile.is_test_account ? "Test personnel file" : "Personnel file"} · ${profile.call_sign ?? "No call sign"} · ${profile.personnel_id}`}
      title={<LocalGreeting />}
      description="Your LSCSO personnel file, documents, qualifications, service history, and requests in one place."
      actions={<>{commandAccess ? <Link className="portal-button portal-button--secondary" href="/portal/command">Command workspace</Link> : null}<Link className="portal-button portal-button--primary" href="#requests">Start a request</Link></>}
    >
      <TestAccountBanner />
      <DeputyNotificationCenter notifications={(notifications.data ?? []).map((item: any): PortalNotificationItem => ({ id: item.id, time: new Date(item.created_at).toLocaleDateString(), title: item.title, detail: item.message, type: item.notification_type, href: item.href, read: Boolean(item.read_at) }))} />

      <section className="deputy-profile-card">
        <div className="deputy-profile-identity"><span>{initials(profile.display_name)}</span><div><small>{profile.is_test_account ? "Test personnel" : "Department personnel"}</small><h2>{profile.display_name}</h2><p>{profile.rank} · {profile.call_sign ?? "No call sign"} · Personnel ID {profile.personnel_id}</p></div></div>
        <div className="deputy-profile-facts"><div><span>Primary assignment</span><strong>{profile.division}</strong></div><div><span>Chain of command</span><strong>{profile.supervisor_label}</strong></div><div><span>Service status</span><strong>{profile.status}</strong></div><div><span>Access tier</span><strong>{profile.access_tier}</strong></div></div>
        <div className="deputy-profile-seal"><strong>My Info</strong><span>Protected personnel record</span></div>
      </section>

      <section className="deputy-summary-grid">
        <article><span>Documents</span><strong>{String(letterRows.length + (guardians.data?.length ?? 0)).padStart(2, "0")}</strong><small>{pendingAcknowledgments} awaiting acknowledgment</small></article>
        <article><span>Current certifications</span><strong>{String(currentCertifications.length).padStart(2, "0")}</strong><small>{pendingCertifications.length} pending review</small></article>
        <article><span>Medals</span><strong>{String(awards.data?.length ?? 0).padStart(2, "0")}</strong><small>Permanent decorations</small></article>
        <article><span>Open requests</span><strong>{String(openRequests).padStart(2, "0")}</strong><small>Awaiting action</small></article>
      </section>

      <section className="portal-panel deputy-document-center" id="documents">
        <div className="portal-panel-heading"><div><p>Protected personnel file</p><h2>My Documents</h2></div><span>{pendingAcknowledgments ? `${pendingAcknowledgments} action required` : "Up to date"}</span></div>
        <p className="personnel-section-intro">Welcome letters, disciplinary actions, commendations, and other issued personnel records are kept here. Records requiring acknowledgment remain clearly marked until you complete them.</p>
        <div className="deputy-document-summary">
          <div><span>Command letters</span><strong>{letterRows.length}</strong></div>
          <div><span>Guardian records</span><strong>{guardians.data?.length ?? 0}</strong></div>
          <div><span>Awaiting you</span><strong>{pendingAcknowledgments}</strong></div>
          <div><span>Disciplinary points</span><strong>{Number(disciplinaryPoints.data ?? 0)}</strong></div>
        </div>
        <div className="personnel-subsection-heading"><div><span>Command correspondence</span><h3>Letters delivered to you</h3></div></div>
        <DeputyCorrespondence letters={letterRows} />
        <DeputyGuardianRecords records={[]} />
        <details className="personnel-history-disclosure">
          <summary>View disciplinary point history <span>{pointEvents.data?.length ?? 0} events</span></summary>
          <div className="deputy-request-history">
            {(pointEvents.data ?? []).map((event: any) => <article key={event.id}><span>{event.delta > 0 ? `+${event.delta}` : event.delta}</span><div><strong>{event.event_type}</strong><small>{event.reason} · {dateLabel(event.effective_on)}</small></div><b>{event.delta > 0 ? "Discipline" : "Restoration"}</b></article>)}
            {!(pointEvents.data ?? []).length ? <div className="portal-empty-state"><strong>No disciplinary point events are on file.</strong></div> : null}
          </div>
        </details>
      </section>

      <section className="portal-panel deputy-certifications" id="certifications">
        <div className="portal-panel-heading"><div><p>Qualifications</p><h2>My Certifications</h2></div><Link href="#requests">Request certification</Link></div>
        <p className="personnel-section-intro">Current qualifications are shown first. Pending requests and prior certifications stay available without turning this page into one long list.</p>
        <div className="personnel-certification-summary"><div><strong>{currentCertifications.length}</strong><span>Current</span></div><div><strong>{pendingCertifications.length}</strong><span>Pending</span></div><div><strong>{pastCertifications.length}</strong><span>Previous</span></div></div>
        <div className="personnel-certification-grid">
          {currentCertifications.map((certification: any) => <article key={certification.id}><span>Current</span><strong>{certification.name}</strong><small>{certification.issuer}</small><dl><div><dt>Issued</dt><dd>{dateLabel(certification.issued_on)}</dd></div><div><dt>Expires</dt><dd>{certification.expires_on ? dateLabel(certification.expires_on) : "No expiration"}</dd></div></dl></article>)}
          {!currentCertifications.length ? <div className="portal-empty-state"><strong>No current certifications are on file.</strong></div> : null}
        </div>
        {pendingCertifications.length ? <details className="personnel-history-disclosure"><summary>Pending certification requests <span>{pendingCertifications.length}</span></summary><div className="personnel-compact-records">{pendingCertifications.map((certification: any) => <div key={certification.id}><strong>{certification.name}</strong><span>{certification.status} · Requested {dateLabel(certification.created_at)}</span></div>)}</div></details> : null}
        {pastCertifications.length ? <details className="personnel-history-disclosure"><summary>Previous certifications <span>{pastCertifications.length}</span></summary><div className="personnel-compact-records">{pastCertifications.map((certification: any) => <div key={certification.id}><strong>{certification.name}</strong><span>{certification.status} · {certification.expires_on ? `Expired ${dateLabel(certification.expires_on)}` : "No longer current"}</span></div>)}</div></details> : null}
      </section>

      <section className="portal-panel" id="awards"><div className="portal-panel-heading"><div><p>Service record</p><h2>Medals & Decorations</h2></div><span>Permanent departmental decorations</span></div><MedalGallery awards={awards.data ?? []} /></section>

      <section className="portal-panel deputy-assignments" id="assignments">
        <div className="portal-panel-heading"><div><p>Current service</p><h2>My Assignments</h2></div><span>{assignments.data?.length ?? 0} active</span></div>
        <div className="personnel-assignment-list personnel-assignment-list--member">
          {(assignments.data ?? []).map((assignment: any) => { const unit = Array.isArray(assignment.organizational_units) ? assignment.organizational_units[0] : assignment.organizational_units; return <article key={assignment.id}><div><span>{assignment.assignment_type}</span><strong>{unit?.name ?? "Unknown unit"}</strong><small>{unit?.unit_type ?? "Organizational assignment"} · Effective {dateLabel(assignment.starts_at)}{assignment.notes ? ` · ${assignment.notes}` : ""}</small></div></article>; })}
          {!(assignments.data ?? []).length ? <div className="portal-empty-state"><strong>No organizational assignments are on file.</strong></div> : null}
        </div>
        <div className="deputy-acting-note"><strong>{(actingGrants.data ?? []).length ? "Acting-supervisor authority active" : "No active acting-supervisor authority"}</strong><span>{(actingGrants.data ?? []).length ? `Expires ${new Date(actingGrants.data[0].expires_at).toLocaleString()}` : "Temporary authority and its expiration will display here."}</span></div>
      </section>

      {(flags.data ?? []).length ? <section className="portal-panel" id="personnel-flags"><div className="portal-panel-heading"><div><p>Administrative indicators</p><h2>Personnel flags</h2></div><span>Flags do not replace Guardian documents</span></div><div className="deputy-request-history">{(flags.data ?? []).map((flag: any) => <article key={flag.id}><span>PF</span><div><strong>{flag.flag_type}</strong><small>{flag.notes ?? "No administrative note"}</small></div><b>Active</b></article>)}</div></section> : null}

      <section className="deputy-progress-section"><div className="portal-section-heading"><div><p>Professional development</p><h2>Training progress</h2></div><span>Academy and FTO records remain part of your personnel history.</span></div><div className="deputy-progress-card"><div><span>{training.data?.[0]?.program_type ?? "Training record"}</span><strong>{training.data?.[0]?.status ?? "No active program"}</strong><p>{training.data?.[0]?.evaluation_notes ?? "Command has not assigned an Academy or FTO progress record."}</p></div><div className="deputy-progress-track" aria-label="Training progress">{(training.data ?? []).map((progress: any, index: number) => <div className={["Complete", "Released"].includes(progress.status) ? "is-complete" : undefined} key={progress.id}><span>{index + 1}</span><strong>{progress.phase}</strong><small>{progress.status}</small></div>)}</div></div></section>
      <LeaveRequestCenter />
      <DeputyRequestCenter />
    </PortalShell>
  );
}
