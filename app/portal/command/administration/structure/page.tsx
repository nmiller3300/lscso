import Link from "next/link";
import { redirect } from "next/navigation";
import { PortalShell } from "../../../_components/PortalShell";
import { createClient } from "@/lib/supabase/server";
import { getCurrentPortalProfile } from "@/lib/supabase/portal-profile";
import { CommandStructureManager } from "./CommandStructureManager";

export default async function CommandStructurePage() {
  const profile = await getCurrentPortalProfile();
  if (!profile || profile.access_tier !== "Executive") {
    redirect("/portal/command/administration");
  }

  const supabase = await createClient() as any;
  const [personnelResult, unitsResult, assignmentsResult, authorityResult] = await Promise.all([
    supabase.from("personnel_profiles")
      .select("id,personnel_id,display_name,rank,call_sign,status")
      .neq("status", "Deactivated")
      .order("display_name"),
    supabase.from("organizational_units")
      .select("id,name,unit_type,parent_unit_id,active,sort_order")
      .eq("active", true)
      .order("sort_order")
      .order("name"),
    supabase.from("personnel_unit_assignments")
      .select("id,profile_id,organizational_unit_id,assignment_type,starts_at,notes")
      .is("ends_at", null)
      .order("starts_at", { ascending: true }),
    supabase.from("supervisory_authorities")
      .select("id,supervisor_profile_id,authority_type,organizational_unit_id,subject_profile_id,starts_at,reason")
      .is("ends_at", null)
      .order("starts_at", { ascending: true }),
  ]);

  const units = unitsResult.data ?? [];
  const assignments = assignmentsResult.data ?? [];
  const authorities = authorityResult.data ?? [];

  return (
    <PortalShell
      active="administration"
      eyebrow="Administration"
      title="Command Structure"
      description="Live organizational units, personnel assignments, and supervisory authority."
      actions={<Link className="portal-button portal-button--secondary" href="/portal/command/administration">Back to Administration</Link>}
    >
      <section className="portal-panel command-structure-status">
        <div className="portal-panel-heading">
          <div><p>V2 authority model</p><h2>Operational structure</h2></div>
          <span>Live</span>
        </div>
        <div className="command-structure-principles">
          <article><span>01</span><div><strong>Organizational units</strong><small>Bureaus, divisions, units, teams, details, programs, and shifts can be nested beneath LSCSO.</small></div></article>
          <article><span>02</span><div><strong>Multiple assignments</strong><small>Primary, secondary, special, temporary, and training assignments can coexist without overwriting one another.</small></div></article>
          <article><span>03</span><div><strong>Separate authority</strong><small>Membership never grants supervision by itself. Supervisory authority is explicitly assigned and audited.</small></div></article>
        </div>
      </section>

      <CommandStructureManager
        personnel={personnelResult.data ?? []}
        units={units}
        assignments={assignments}
        authorities={authorities}
      />

      <div className="command-structure-layout command-structure-reference-layout">
        <section className="portal-panel">
          <div className="portal-panel-heading"><div><p>Live totals</p><h2>Structure at a glance</h2></div></div>
          <div className="deputy-summary-grid command-v2-record-metrics">
            <article><span>Units</span><strong>{String(Math.max(units.length - 1, 0)).padStart(2, "0")}</strong><small>Active beneath LSCSO</small></article>
            <article><span>Assignments</span><strong>{String(assignments.length).padStart(2, "0")}</strong><small>Active personnel scopes</small></article>
            <article><span>Authority</span><strong>{String(authorities.length).padStart(2, "0")}</strong><small>Active supervisory grants</small></article>
            <article><span>Personnel</span><strong>{String(personnelResult.data?.length ?? 0).padStart(2, "0")}</strong><small>Active / acting records</small></article>
          </div>
        </section>

        <aside className="command-structure-side">
          <section className="portal-panel">
            <div className="portal-panel-heading"><div><p>Standing authority</p><h2>Command boundary</h2></div></div>
            <div className="command-structure-rank-list">
              <div><strong>Sheriff / Undersheriff</strong><span>Executive · department-wide</span></div>
              <div><strong>Major / Captain</strong><span>Command · department-wide operational reach</span></div>
              <div><strong>1st Lieutenant</strong><span>Command Staff · structured purview</span></div>
              <div><strong>Lieutenant / Sergeant / Corporal</strong><span>Scoped supervisory purview</span></div>
            </div>
          </section>
        </aside>
      </div>
    </PortalShell>
  );
}
