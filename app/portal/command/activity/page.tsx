import { redirect } from "next/navigation";
import { PortalShell } from "../../_components/PortalShell";
import { getCurrentPortalProfile } from "@/lib/supabase/portal-profile";
import { createClient } from "@/lib/supabase/server";

export default async function ActivityPage() {
  const profile = await getCurrentPortalProfile();
  if (!profile || !["Executive", "Command"].includes(profile.access_tier)) redirect("/portal/command/guardians");
  const supabase = await createClient();
  const [{ data: audit }, { data: sessions }, { data: profiles }] = await Promise.all([
    supabase.from("audit_log").select("id,actor_profile_id,action,table_name,record_id,created_at").order("created_at", { ascending: false }).limit(100),
    supabase.from("session_events").select("id,profile_id,event_type,user_agent,created_at").order("created_at", { ascending: false }).limit(50),
    supabase.from("personnel_profiles").select("id,display_name,rank,call_sign"),
  ]);
  const people = new Map((profiles ?? []).map((item) => [item.id, item]));
  return (
    <PortalShell active="activity" eyebrow="Accountability · Audit history" title="Activity & Audit" description="Review attributed personnel, authentication, Guardian, certification, request, and account actions.">
      <section className="portal-metric-grid">
        <article className="portal-metric portal-metric--neutral"><span>Audit events loaded</span><strong>{String(audit?.length ?? 0).padStart(2, "0")}</strong><small>Most recent protected actions</small></article>
        <article className="portal-metric portal-metric--neutral"><span>Session events loaded</span><strong>{String(sessions?.length ?? 0).padStart(2, "0")}</strong><small>Authentication and password activity</small></article>
      </section>
      <section className="portal-panel" id="audit-log">
        <div className="portal-panel-heading"><div><p>Department records</p><h2>Audit log</h2></div><span>Newest first</span></div>
        <div className="deputy-request-history">
          {(audit ?? []).map((event) => {
            const actor = event.actor_profile_id ? people.get(event.actor_profile_id) : null;
            return <article key={event.id}><span>AU</span><div><strong>{event.action}</strong><small>{actor ? `${actor.display_name} · ${actor.rank}${actor.call_sign ? ` · ${actor.call_sign}` : ""}` : "System"} · {event.table_name}{event.record_id ? ` · ${event.record_id}` : ""}</small></div><b>{new Date(event.created_at).toLocaleString()}</b></article>;
          })}
          {!(audit ?? []).length ? <div className="portal-empty-state"><strong>No audit events are available.</strong></div> : null}
        </div>
      </section>
      <section className="portal-panel" id="session-events">
        <div className="portal-panel-heading"><div><p>Authentication</p><h2>Session activity</h2></div><span>Account security events</span></div>
        <div className="deputy-request-history">
          {(sessions ?? []).map((event) => {
            const actor = people.get(event.profile_id);
            return <article key={event.id}><span>SE</span><div><strong>{event.event_type}</strong><small>{actor ? `${actor.display_name} · ${actor.rank}` : "Personnel"} · {event.user_agent ?? "No device detail"}</small></div><b>{new Date(event.created_at).toLocaleString()}</b></article>;
          })}
          {!(sessions ?? []).length ? <div className="portal-empty-state"><strong>No session events are available.</strong></div> : null}
        </div>
      </section>
    </PortalShell>
  );
}
