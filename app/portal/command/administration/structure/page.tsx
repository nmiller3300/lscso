import Link from "next/link";
import { redirect } from "next/navigation";
import { PortalShell } from "../../../_components/PortalShell";
import { createClient } from "@/lib/supabase/server";
import { getCurrentPortalProfile } from "@/lib/supabase/portal-profile";

export default async function CommandStructurePage() {
  const profile = await getCurrentPortalProfile();
  if (!profile || profile.access_tier !== "Executive") {
    redirect("/portal/command/administration");
  }

  const supabase = await createClient() as any;
  const { data: personnel } = await supabase
    .from("personnel_profiles")
    .select("personnel_id,display_name,rank,call_sign,division,status")
    .neq("status", "Deactivated")
    .order("rank");

  const groups = new Map<string, any[]>();
  for (const member of personnel ?? []) {
    const label = member.division || "Unassigned";
    const rows = groups.get(label) ?? [];
    rows.push(member);
    groups.set(label, rows);
  }

  return (
    <PortalShell
      active="administration"
      eyebrow="Administration"
      title="Command Structure"
      description="Organizational units, assignments, and supervisory authority."
      actions={<Link className="portal-button portal-button--secondary" href="/portal/command/administration">Back to Administration</Link>}
    >
      <section className="portal-panel command-structure-status">
        <div className="portal-panel-heading">
          <div><p>V2 authority model</p><h2>Structure preview</h2></div>
          <span>Read only</span>
        </div>
        <div className="command-structure-principles">
          <article><span>01</span><div><strong>Organizational units</strong><small>Bureaus, divisions, units, teams, details, programs, and shifts.</small></div></article>
          <article><span>02</span><div><strong>Personnel assignments</strong><small>Primary, secondary, special, temporary, or training assignments.</small></div></article>
          <article><span>03</span><div><strong>Supervisory authority</strong><small>Who currently has operational purview over a person or unit.</small></div></article>
        </div>
      </section>

      <div className="command-structure-layout">
        <section className="portal-panel">
          <div className="portal-panel-heading"><div><p>Current data</p><h2>Profile division labels</h2></div><span>{groups.size} groups</span></div>
          <div className="command-structure-groups">
            {Array.from(groups.entries()).sort(([a],[b]) => a.localeCompare(b)).map(([division, members]) => (
              <article key={division}>
                <div className="command-structure-group-head"><strong>{division}</strong><span>{members.length} personnel</span></div>
                <div className="command-structure-members">
                  {members.map((member:any) => <div key={member.personnel_id}><span>{member.display_name}</span><small>{member.rank} · {member.call_sign ?? member.personnel_id}</small></div>)}
                </div>
              </article>
            ))}
          </div>
          <small className="command-structure-footnote">These labels are shown for reference only. They do not establish V2 supervisory authority.</small>
        </section>

        <aside className="command-structure-side">
          <section className="portal-panel">
            <div className="portal-panel-heading"><div><p>Authority</p><h2>Standing command</h2></div></div>
            <div className="command-structure-rank-list">
              <div><strong>Sheriff / Undersheriff</strong><span>Executive · department-wide</span></div>
              <div><strong>Major / Captain</strong><span>Command · department-wide operational reach</span></div>
              <div><strong>1st Lieutenant</strong><span>Command Staff · assigned purview</span></div>
              <div><strong>Lieutenant / Sergeant / Corporal</strong><span>Scoped supervisory purview</span></div>
            </div>
          </section>

          <section className="portal-panel">
            <div className="portal-panel-heading"><div><p>Activation</p><h2>Structured assignments</h2></div></div>
            <div className="command-v2-inline-state"><strong>Not active in the production database.</strong><span>The V2 structure schema remains isolated until approved.</span></div>
          </section>
        </aside>
      </div>
    </PortalShell>
  );
}
