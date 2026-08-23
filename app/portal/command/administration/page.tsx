import Link from "next/link";
import { redirect } from "next/navigation";
import { PortalShell } from "../../_components/PortalShell";
import { getCurrentPortalProfile } from "@/lib/supabase/portal-profile";

export default async function AdministrationWorkspacePage() {
  const profile = await getCurrentPortalProfile();
  if (!profile || !["Executive", "Command"].includes(profile.access_tier)) {
    redirect("/portal/command/supervision");
  }

  const executive = profile.access_tier === "Executive";

  return (
    <PortalShell
      active="administration"
      eyebrow="Administration"
      title="Administration"
      description="Department decisions, records, audit history, and organization tools."
    >
      <div className="command-v2-workspace-grid">
        <section className="portal-panel command-v2-launcher">
          <div className="portal-panel-heading"><div><p>Waiting on Command</p><h2>Review approvals</h2></div></div>
          <p className="command-v2-compact-copy">Approve or deny pending Guardians, personnel requests, LOA requests, and certification requests.</p>
          <div className="command-v2-action-row">
            <Link className="portal-button portal-button--primary" href="/portal/command/approvals">Review pending items</Link>
          </div>
        </section>

        <section className="portal-panel command-v2-launcher">
          <div className="portal-panel-heading"><div><p>Audit history</p><h2>See who changed what</h2></div></div>
          <p className="command-v2-compact-copy">Review recorded portal actions and personnel changes when you need to verify what happened.</p>
          <div className="command-v2-action-row">
            <Link className="portal-button portal-button--primary" href="/portal/command/activity">View activity log</Link>
          </div>
        </section>

        <section className="portal-panel command-v2-launcher">
          <div className="portal-panel-heading"><div><p>Personnel history</p><h2>Service records</h2></div></div>
          <p className="command-v2-compact-copy">Review permanent service and career information without digging through the full roster.</p>
          <div className="command-v2-action-row">
            <Link className="portal-button portal-button--secondary" href="/portal/command/service-records">Open service records</Link>
          </div>
        </section>

        {executive ? <section className="portal-panel command-v2-launcher">
          <div className="portal-panel-heading"><div><p>Department organization</p><h2>Structure & assignments</h2></div><span>Executive</span></div>
          <p className="command-v2-compact-copy">Manage the department structure, unit assignments, and who holds organizational authority.</p>
          <div className="command-v2-action-row">
            <Link className="portal-button portal-button--secondary" href="/portal/command/administration/structure">Open department structure</Link>
          </div>
        </section> : null}
      </div>
    </PortalShell>
  );
}
