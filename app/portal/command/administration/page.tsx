import Link from "next/link";
import { redirect } from "next/navigation";
import { PortalShell } from "../../_components/PortalShell";
import { getCurrentPortalProfile } from "@/lib/supabase/portal-profile";

export default async function AdministrationWorkspacePage() {
  const profile = await getCurrentPortalProfile();
  if (!profile || !["Executive", "Command"].includes(profile.access_tier)) {
    redirect("/portal/command/supervision");
  }

  return (
    <PortalShell
      active="administration"
      eyebrow="Administration"
      title="Administration"
      description="Approvals, leave, audit activity, and department administration."
    >
      <div className="command-v2-workspace-grid">
        <section className="portal-panel command-v2-launcher">
          <div className="portal-panel-heading"><div><p>Decision queue</p><h2>Approvals</h2></div></div>
          <p className="command-v2-compact-copy">Review pending Guardians, requests, and administrative actions.</p>
          <div className="command-v2-action-row">
            <Link className="portal-button portal-button--primary" href="/portal/command/approvals">Open approvals</Link>
          </div>
        </section>

        <section className="portal-panel command-v2-launcher">
          <div className="portal-panel-heading"><div><p>Audit</p><h2>Activity</h2></div></div>
          <p className="command-v2-compact-copy">Review recorded portal and personnel activity.</p>
          <div className="command-v2-action-row">
            <Link className="portal-button portal-button--primary" href="/portal/command/activity">Open activity</Link>
          </div>
        </section>

        <section className="portal-panel command-v2-launcher">
          <div className="portal-panel-heading"><div><p>Personnel admin</p><h2>Service records</h2></div></div>
          <p className="command-v2-compact-copy">Administrative personnel actions remain available without crowding the landing page.</p>
          <div className="command-v2-action-row">
            <Link className="portal-button portal-button--secondary" href="/portal/command/service-records">Open service records</Link>
          </div>
        </section>
      </div>
    </PortalShell>
  );
}
