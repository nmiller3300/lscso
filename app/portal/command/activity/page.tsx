import Link from "next/link";
import { redirect } from "next/navigation";
import { PortalShell } from "../../_components/PortalShell";
import { getCurrentPortalProfile } from "@/lib/supabase/portal-profile";
import { createClient } from "@/lib/supabase/server";

const PAGE_SIZE = 50;

function pageNumber(value: string | string[] | undefined) {
  const raw = Array.isArray(value) ? value[0] : value;
  const parsed = Number.parseInt(raw ?? "1", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
}

function activityHref(auditPage: number, sessionPage: number) {
  const query = new URLSearchParams();
  if (auditPage > 1) query.set("auditPage", String(auditPage));
  if (sessionPage > 1) query.set("sessionPage", String(sessionPage));
  const suffix = query.toString();
  return suffix ? `/portal/command/activity?${suffix}` : "/portal/command/activity";
}

export default async function ActivityPage({ searchParams }: { searchParams: Promise<{ auditPage?: string | string[]; sessionPage?: string | string[] }> }) {
  const profile = await getCurrentPortalProfile();
  if (!profile || !["Executive", "Command"].includes(profile.access_tier)) redirect("/portal/command/guardians");

  const params = await searchParams;
  const auditPage = pageNumber(params.auditPage);
  const sessionPage = pageNumber(params.sessionPage);
  const auditFrom = (auditPage - 1) * PAGE_SIZE;
  const sessionFrom = (sessionPage - 1) * PAGE_SIZE;

  const supabase = await createClient() as any;
  const [auditResult, sessionResult, profileResult] = await Promise.all([
    supabase
      .from("audit_log")
      .select("id,actor_profile_id,action,table_name,record_id,created_at", { count: "exact" })
      .order("created_at", { ascending: false })
      .range(auditFrom, auditFrom + PAGE_SIZE - 1),
    supabase
      .from("session_events")
      .select("id,profile_id,event_type,user_agent,created_at", { count: "exact" })
      .order("created_at", { ascending: false })
      .range(sessionFrom, sessionFrom + PAGE_SIZE - 1),
    supabase.from("personnel_profiles").select("id,display_name,rank,call_sign"),
  ]);

  const audit = auditResult.data ?? [];
  const sessions = sessionResult.data ?? [];
  const auditCount = Number(auditResult.count ?? audit.length);
  const sessionCount = Number(sessionResult.count ?? sessions.length);
  const auditPages = Math.max(1, Math.ceil(auditCount / PAGE_SIZE));
  const sessionPages = Math.max(1, Math.ceil(sessionCount / PAGE_SIZE));
  const people = new Map((profileResult.data ?? []).map((item: any) => [item.id, item]));

  return (
    <PortalShell active="activity" eyebrow="Accountability · Audit history" title="Activity & Audit" description="Review attributed personnel, authentication, Guardian, certification, request, and account actions.">
      <section className="portal-metric-grid">
        <article className="portal-metric portal-metric--neutral"><span>Audit events</span><strong>{auditCount.toLocaleString()}</strong><small>{audit.length} shown on page {auditPage}</small></article>
        <article className="portal-metric portal-metric--neutral"><span>Session events</span><strong>{sessionCount.toLocaleString()}</strong><small>{sessions.length} shown on page {sessionPage}</small></article>
      </section>

      <section className="portal-panel" id="audit-log">
        <div className="portal-panel-heading"><div><p>Department records</p><h2>Audit log</h2></div><span>Newest first · Page {auditPage} of {auditPages}</span></div>
        <div className="deputy-request-history">
          {audit.map((event: any) => {
            const actor = event.actor_profile_id ? people.get(event.actor_profile_id) : null;
            return <article key={event.id}><span>AU</span><div><strong>{event.action}</strong><small>{actor ? `${actor.display_name} · ${actor.rank}${actor.call_sign ? ` · ${actor.call_sign}` : ""}` : "System"} · {event.table_name}{event.record_id ? ` · ${event.record_id}` : ""}</small></div><b>{new Date(event.created_at).toLocaleString()}</b></article>;
          })}
          {!audit.length ? <div className="portal-empty-state"><strong>No audit events are available on this page.</strong></div> : null}
        </div>
        {auditPages > 1 ? <div className="portal-page-actions" style={{ marginTop: 16 }}>
          {auditPage > 1 ? <Link className="portal-button portal-button--secondary" href={activityHref(auditPage - 1, sessionPage)}>Newer audit events</Link> : null}
          {auditPage < auditPages ? <Link className="portal-button portal-button--secondary" href={activityHref(auditPage + 1, sessionPage)}>Older audit events</Link> : null}
        </div> : null}
      </section>

      <section className="portal-panel" id="session-events">
        <div className="portal-panel-heading"><div><p>Authentication</p><h2>Session activity</h2></div><span>Page {sessionPage} of {sessionPages}</span></div>
        <div className="deputy-request-history">
          {sessions.map((event: any) => {
            const actor = people.get(event.profile_id);
            return <article key={event.id}><span>SE</span><div><strong>{event.event_type}</strong><small>{actor ? `${actor.display_name} · ${actor.rank}` : "Personnel"} · {event.user_agent ?? "No device detail"}</small></div><b>{new Date(event.created_at).toLocaleString()}</b></article>;
          })}
          {!sessions.length ? <div className="portal-empty-state"><strong>No session events are available on this page.</strong></div> : null}
        </div>
        {sessionPages > 1 ? <div className="portal-page-actions" style={{ marginTop: 16 }}>
          {sessionPage > 1 ? <Link className="portal-button portal-button--secondary" href={activityHref(auditPage, sessionPage - 1)}>Newer session events</Link> : null}
          {sessionPage < sessionPages ? <Link className="portal-button portal-button--secondary" href={activityHref(auditPage, sessionPage + 1)}>Older session events</Link> : null}
        </div> : null}
      </section>
    </PortalShell>
  );
}
