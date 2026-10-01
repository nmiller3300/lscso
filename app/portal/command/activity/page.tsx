import Link from "next/link";
import { redirect } from "next/navigation";
import { PortalShell } from "../../_components/PortalShell";
import { getCurrentPortalProfile } from "@/lib/supabase/portal-profile";
import { createClient } from "@/lib/supabase/server";

const PAGE_SIZE = 50;

type ActivityPageProps = {
  searchParams: Promise<{ auditPage?: string; sessionPage?: string }>;
};

function pageNumber(value: string | undefined) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : 1;
}

function pageHref(auditPage: number, sessionPage: number, anchor: string) {
  const query = new URLSearchParams({ auditPage: String(auditPage), sessionPage: String(sessionPage) });
  return `/portal/command/activity?${query.toString()}#${anchor}`;
}

export default async function ActivityPage({ searchParams }: ActivityPageProps) {
  const profile = await getCurrentPortalProfile();
  if (!profile || !["Executive", "Command"].includes(profile.access_tier)) redirect("/portal/command/guardians");

  const params = await searchParams;
  const auditPage = pageNumber(params.auditPage);
  const sessionPage = pageNumber(params.sessionPage);
  const auditFrom = (auditPage - 1) * PAGE_SIZE;
  const sessionFrom = (sessionPage - 1) * PAGE_SIZE;
  const supabase = await createClient() as any;

  const [auditResult, sessionResult, profilesResult] = await Promise.all([
    supabase.from("audit_log").select("id,actor_profile_id,action,table_name,record_id,created_at", { count: "exact" }).order("created_at", { ascending: false }).range(auditFrom, auditFrom + PAGE_SIZE - 1),
    supabase.from("session_events").select("id,profile_id,event_type,user_agent,created_at", { count: "exact" }).order("created_at", { ascending: false }).range(sessionFrom, sessionFrom + PAGE_SIZE - 1),
    supabase.from("personnel_profiles").select("id,display_name,rank,call_sign"),
  ]);

  const audit = auditResult.data ?? [];
  const sessions = sessionResult.data ?? [];
  const auditCount = Number(auditResult.count ?? 0);
  const sessionCount = Number(sessionResult.count ?? 0);
  const auditPages = Math.max(1, Math.ceil(auditCount / PAGE_SIZE));
  const sessionPages = Math.max(1, Math.ceil(sessionCount / PAGE_SIZE));
  const people = new Map((profilesResult.data ?? []).map((item: any) => [item.id, item]));

  return (
    <PortalShell active="activity" eyebrow="Accountability · Audit history" title="Activity & Audit" description="Review attributed personnel, authentication, Guardian, certification, request, and account actions.">
      <section className="portal-metric-grid">
        <article className="portal-metric portal-metric--neutral"><span>Audit events</span><strong>{auditCount}</strong><small>Protected actions on record</small></article>
        <article className="portal-metric portal-metric--neutral"><span>Session events</span><strong>{sessionCount}</strong><small>Authentication and password activity</small></article>
      </section>

      <section className="portal-panel" id="audit-log">
        <div className="portal-panel-heading"><div><p>Department records</p><h2>Audit log</h2></div><span>{auditCount} total</span></div>
        <div className="deputy-request-history">
          {audit.map((event: any) => {
            const actor = event.actor_profile_id ? people.get(event.actor_profile_id) as any : null;
            return <article key={event.id}><span>AU</span><div><strong>{event.action}</strong><small>{actor ? `${actor.display_name} · ${actor.rank}${actor.call_sign ? ` · ${actor.call_sign}` : ""}` : "System"} · {event.table_name}{event.record_id ? ` · ${event.record_id}` : ""}</small></div><b>{new Date(event.created_at).toLocaleString()}</b></article>;
          })}
          {!audit.length ? <div className="portal-empty-state"><strong>No audit events are available on this page.</strong></div> : null}
        </div>
        {auditPages > 1 ? <nav className="portal-pagination" aria-label="Audit log pages"><Link className={`portal-button portal-button--secondary ${auditPage <= 1 ? "is-disabled" : ""}`} href={pageHref(Math.max(1, auditPage - 1), sessionPage, "audit-log")}>Previous</Link><span>Page {Math.min(auditPage, auditPages)} of {auditPages}</span><Link className={`portal-button portal-button--secondary ${auditPage >= auditPages ? "is-disabled" : ""}`} href={pageHref(Math.min(auditPages, auditPage + 1), sessionPage, "audit-log")}>Next</Link></nav> : null}
      </section>

      <section className="portal-panel" id="session-events">
        <div className="portal-panel-heading"><div><p>Authentication</p><h2>Session activity</h2></div><span>{sessionCount} total</span></div>
        <div className="deputy-request-history">
          {sessions.map((event: any) => {
            const actor = people.get(event.profile_id) as any;
            return <article key={event.id}><span>SE</span><div><strong>{event.event_type}</strong><small>{actor ? `${actor.display_name} · ${actor.rank}` : "Personnel"} · {event.user_agent ?? "No device detail"}</small></div><b>{new Date(event.created_at).toLocaleString()}</b></article>;
          })}
          {!sessions.length ? <div className="portal-empty-state"><strong>No session events are available on this page.</strong></div> : null}
        </div>
        {sessionPages > 1 ? <nav className="portal-pagination" aria-label="Session activity pages"><Link className={`portal-button portal-button--secondary ${sessionPage <= 1 ? "is-disabled" : ""}`} href={pageHref(auditPage, Math.max(1, sessionPage - 1), "session-events")}>Previous</Link><span>Page {Math.min(sessionPage, sessionPages)} of {sessionPages}</span><Link className={`portal-button portal-button--secondary ${sessionPage >= sessionPages ? "is-disabled" : ""}`} href={pageHref(auditPage, Math.min(sessionPages, sessionPage + 1), "session-events")}>Next</Link></nav> : null}
      </section>
    </PortalShell>
  );
}
