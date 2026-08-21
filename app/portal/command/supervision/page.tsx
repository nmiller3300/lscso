import Link from "next/link";
import { PortalShell } from "../../_components/PortalShell";
import { getCurrentPortalProfile } from "@/lib/supabase/portal-profile";

export default async function SupervisionWorkspacePage() {
  const profile = await getCurrentPortalProfile();
  if (!profile) return null;

  return (
    <PortalShell
      active="supervision"
      eyebrow="Supervision"
      title="Supervision"
      description="Personnel oversight, Guardians, follow-ups, and supervisory actions."
    >
      <div className="command-v2-workspace-grid">
        <section className="portal-panel command-v2-launcher">
          <div className="portal-panel-heading"><div><p>My scope</p><h2>Personnel under my purview</h2></div></div>
          <p className="command-v2-compact-copy">Current personnel will appear here by active command, unit, or supervisory assignment.</p>
          <div className="command-v2-action-row">
            <Link className="portal-button portal-button--primary" href="/portal/command/personnel">Open personnel</Link>
          </div>
        </section>

        <section className="portal-panel command-v2-launcher">
          <div className="portal-panel-heading"><div><p>Accountability</p><h2>Guardians</h2></div></div>
          <p className="command-v2-compact-copy">Find an existing Guardian or create a new record.</p>
          <div className="command-v2-action-row">
            <Link className="portal-button portal-button--primary" href="/portal/command/guardians">Guardian Center</Link>
          </div>
        </section>

        <section className="portal-panel command-v2-launcher">
          <div className="portal-panel-heading"><div><p>Follow-up</p><h2>Needs attention</h2></div></div>
          <p className="command-v2-compact-copy">Overdue follow-ups and supervisory items will surface here without loading the full record history.</p>
        </section>
      </div>
    </PortalShell>
  );
}
