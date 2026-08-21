import Image from "next/image";
import Link from "next/link";
import { DeputyGuardianRecords, DeputyRequestCenter } from "../_components/DeputyInteractions";
import { DeputyNotificationCenter, type PortalNotificationItem } from "../_components/CommandInteractions";
import { LeaveRequestCenter } from "../_components/LeaveRequestCenter";
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

  const supabase = await createClient() as any;
  const [
    { data: certifications },
    { data: assignments },
    { data: guardians },
    { data: requests },
    { data: training },
    { data: notifications },
    { data: actingGrants },
    { data: awards },
    { data: flags },
    { data: pointEvents },
    { data: disciplinaryPoints },
  ] = await Promise.all([
    supabase.from("certifications").select("*").eq("profile_id", profile.id).order("created_at", { ascending: false }),
    supabase.from("division_assignments").select("*").eq("profile_id", profile.id).order("effective_at", { ascending: false }),
    supabase.from("guardian_records").select("id,status,record_type,points_assessed").eq("subject_profile_id", profile.id),
    supabase.from("personnel_requests").select("id,status").eq("requester_profile_id", profile.id),
    supabase.from("training_progress").select("*").eq("profile_id", profile.id).order("created_at"),
    supabase.from("notifications").select("id,notification_type,title,message,href,read_at,created_at").eq("recipient_profile_id", profile.id).order("created_at", { ascending: false }).limit(4),
    supabase.from("acting_supervisor_grants").select("*").eq("profile_id", profile.id).is("revoked_at", null).gt("expires_at", new Date().toISOString()),
    supabase.from("personnel_awards").select("id,award_name,citation,awarded_on,image_asset_path,awarded_by").eq("profile_id", profile.id).order("awarded_on", { ascending: false }),
    supabase.from("personnel_flags").select("id,flag_type,notes,created_at").eq("profile_id", profile.id).eq("active", true).order("created_at", { ascending: false }),
    supabase.from("disciplinary_point_events").select("id,event_type,delta,reason,effective_on,authorized_by").eq("profile_id", profile.id).order("effective_on", { ascending: false }).order("created_at", { ascending: false }),
    supabase.rpc("get_disciplinary_point_total", { target_profile_id: profile.id }),
  ]);

  const currentCertifications = (certifications ?? []).filter((item: any) => item.status === "Current").length;
  const pendingCertifications = (certifications ?? []).filter((item: any) => ["Requested", "Pending"].includes(item.status)).length;
  const openRequests = (requests ?? []).filter((item: any) => !["Denied", "Cancelled", "Completed"].includes(item.status)).length;
  const currentAssignments = (assignments ?? []).filter((item: any) => !item.ends_at || new Date(item.ends_at) > new Date());
  const guardianCount = (guardians ?? []).length;
  const commandAccess = ["Executive", "Command"].includes(profile.access_tier);

  return (
    <PortalShell active="record" audience="deputy" eyebrow={`${profile.is_test_account ? "Test personnel file" : "Personnel file"} · ${profile.call_sign ?? "No call sign"} · ${profile.personnel_id}`} title={<LocalGreeting />} description="Your complete LSCSO service record. Rank never removes access to your own personnel information." actions={<>{commandAccess ? <Link className="portal-button portal-button--secondary" href="/portal/command">Command workspace</Link> : null}<Link className="portal-button portal-button--primary" href="#requests">Start a request</Link></>}>
      <TestAccountBanner />
      <DeputyNotificationCenter notifications={(notifications ?? []).map((notification: any): PortalNotificationItem => ({ id: notification.id, time: new Date(notification.created_at).toLocaleDateString(), title: notification.title, detail: notification.message, type: notification.notification_type, href: notification.href, read: Boolean(notification.read_at) }))} />

      <section className="deputy-profile-card">
        <div className="deputy-profile-identity"><span>{initials(profile.display_name)}</span><div><small>{profile.is_test_account ? "Test personnel" : "Department personnel"}</small><h2>{profile.display_name}</h2><p>{profile.rank} · {profile.call_sign ?? "No call sign"} · Personnel ID {profile.personnel_id}</p></div></div>
        <div className="deputy-profile-facts"><div><span>Primary assignment</span><strong>{profile.division}</strong></div><div><span>Chain of command</span><strong>{profile.supervisor_label}</strong></div><div><span>Service status</span><strong>{profile.status}</strong></div><div><span>Access tier</span><strong>{profile.access_tier}</strong></div></div>
        <div className="deputy-profile-seal"><strong>My Office</strong><span>Protected service record</span></div>
      </section>

      <section className="deputy-summary-grid">
        <article><span>Disciplinary points</span><strong>{String(Number(disciplinaryPoints ?? 0)).padStart(2, "0")}</strong><small>Current active strike score</small></article>
        <article><span>Certifications</span><strong>{String(certifications?.length ?? 0).padStart(2, "0")}</strong><small>{currentCertifications} current · {pendingCertifications} pending</small></article>
        <article><span>Medals & awards</span><strong>{String(awards?.length ?? 0).padStart(2, "0")}</strong><small>Permanent decorations</small></article>
        <article><span>Open requests</span><strong>{String(openRequests).padStart(2, "0")}</strong><small>Awaiting action</small></article>
      </section>

      <section className="portal-panel" id="discipline"><div className="portal-panel-heading"><div><p>Accountability</p><h2>Disciplinary standing</h2></div><span>{Number(disciplinaryPoints ?? 0)} active points</span></div><div className="deputy-request-history">{(pointEvents ?? []).map((event: any) => <article key={event.id}><span>{event.delta > 0 ? `+${event.delta}` : event.delta}</span><div><strong>{event.event_type}</strong><small>{event.reason} · {new Date(event.effective_on).toLocaleDateString()}</small></div><b>{event.delta > 0 ? "Discipline" : "Restoration"}</b></article>)}{!(pointEvents ?? []).length ? <div className="portal-empty-state"><strong>No disciplinary point events are on file.</strong></div> : null}</div><div className="deputy-record-rights"><div><strong>Restoration rules</strong><span>Outstanding Performance may restore 1 point per qualifying month. Department-head commendations may restore 1–3 points, maximum 3 per month. Your score can never fall below 0 and restoration is never banked for future discipline.</span></div></div></section>

      <section className="portal-panel" id="awards"><div className="portal-panel-heading"><div><p>Service record</p><h2>Medals & Decorations</h2></div><span>Distinct from commendations and performance restoration</span></div><div className="deputy-certification-list">{(awards ?? []).map((award: any) => <article key={award.id}>{award.image_asset_path ? <Image src={award.image_asset_path} alt={`${award.award_name} medal`} width={54} height={54} /> : <span aria-hidden="true">★</span>}<div><strong>{award.award_name}</strong><small>{award.citation}</small></div><div><small>Awarded</small><strong>{new Date(award.awarded_on).toLocaleDateString()}</strong></div><b>Decoration</b></article>)}{!(awards ?? []).length ? <div className="portal-empty-state"><strong>No medals or decorations have been awarded.</strong><span>Approved medal artwork will display here once the LSCSO assets are uploaded.</span></div> : null}</div></section>

      <div className="deputy-content-grid">
        <section className="portal-panel deputy-certifications" id="certifications"><div className="portal-panel-heading"><div><p>Qualifications</p><h2>Certifications</h2></div><Link href="#requests">Request certification</Link></div><div className="deputy-certification-list">{(certifications ?? []).map((certification: any) => <article key={certification.id}><span className={["Requested", "Pending"].includes(certification.status) ? "is-pending" : undefined} aria-hidden="true">{["Requested", "Pending"].includes(certification.status) ? "…" : "✓"}</span><div><strong>{certification.name}</strong><small>{certification.issuer} · Issued {certification.issued_on ?? "Pending"}</small></div><div><small>Expiration</small><strong>{certification.expires_on ?? "No expiration"}</strong></div><b className={["Requested", "Pending"].includes(certification.status) ? "is-pending" : undefined}>{certification.status}</b></article>)}{(certifications ?? []).length === 0 ? <div className="portal-empty-state"><strong>No certifications are on file.</strong></div> : null}</div></section>
        <aside className="portal-panel deputy-assignments" id="assignments"><div className="portal-panel-heading"><div><p>Current duty</p><h2>Assignments</h2></div></div>{currentAssignments.map((assignment: any) => <article key={assignment.id}><span>{assignment.assignment_type}</span><strong>{assignment.division}</strong><p>{assignment.notes ?? "Active assignment"}</p><small>Effective {new Date(assignment.effective_at).toLocaleDateString()}</small></article>)}{currentAssignments.length === 0 ? <div className="portal-empty-state"><strong>No division assignments are on file.</strong></div> : null}<div className="deputy-acting-note"><strong>{(actingGrants ?? []).length ? "Acting-supervisor authority active" : "No active acting-supervisor authority"}</strong><span>{(actingGrants ?? []).length ? `Expires ${new Date(actingGrants![0].expires_at).toLocaleString()}` : "Temporary permissions will display here with their automatic expiration time."}</span></div></aside>
      </div>

      {(flags ?? []).length ? <section className="portal-panel" id="personnel-flags"><div className="portal-panel-heading"><div><p>Administrative indicators</p><h2>Personnel flags</h2></div><span>Flags do not replace Guardians or change disciplinary points</span></div><div className="deputy-request-history">{(flags ?? []).map((flag: any) => <article key={flag.id}><span>PF</span><div><strong>{flag.flag_type}</strong><small>{flag.notes ?? "No administrative note"}</small></div><b>Active</b></article>)}</div></section> : null}

      <DeputyGuardianRecords records={[]} />
      <section className="deputy-progress-section"><div className="portal-section-heading"><div><p>Professional development</p><h2>Training progress</h2></div><span>Academy and FTO records remain part of your personnel history.</span></div><div className="deputy-progress-card"><div><span>{training?.[0]?.program_type ?? "Training record"}</span><strong>{training?.[0]?.status ?? "No active program"}</strong><p>{training?.[0]?.evaluation_notes ?? "Command has not assigned an Academy or FTO progress record."}</p></div><div className="deputy-progress-track" aria-label="Training progress">{(training ?? []).map((phase: any, index: number) => <div className={["Complete", "Released"].includes(phase.status) ? "is-complete" : undefined} key={phase.id}><span>{index + 1}</span><strong>{phase.phase}</strong><small>{phase.status}</small></div>)}</div></div></section>
      <LeaveRequestCenter />
      <DeputyRequestCenter />
    </PortalShell>
  );
}
