import Link from "next/link";
import { redirect } from "next/navigation";
import { PortalShell } from "../../_components/PortalShell";
import { createClient } from "@/lib/supabase/server";
import { getCurrentPortalProfile } from "@/lib/supabase/portal-profile";

const STANDING_ACCOUNT_ADMIN = new Set(["Sheriff", "Undersheriff", "Major", "Captain"]);

export default async function AdministrationWorkspacePage() {
  const profile = await getCurrentPortalProfile();
  if (!profile || !["Executive", "Command"].includes(profile.access_tier)) {
    redirect("/portal/command/supervision");
  }

  const executive = profile.access_tier === "Executive";
  const supabase = await createClient() as any;
  const { data: accessRows } = await supabase.rpc("get_my_roster_access");
  const delegations = new Set<string>(accessRows?.[0]?.active_delegations ?? []);
  const canManageAccounts = STANDING_ACCOUNT_ADMIN.has(profile.rank)
    || delegations.has("Personnel Administration")
    || delegations.has("Temporary Command Authority");

  return (
    <PortalShell
      active="administration"
      eyebrow="Administration"
      title="Administration"
      description="Department access, decisions, records, audit activity, and executive configuration."
    >
      <div className="command-admin-groups">
        <section className="command-admin-group">
          <div className="portal-section-heading">
            <div><p>Personnel administration</p><h2>People & records</h2></div>
            <span>Account and service-record tools stay together here.</span>
          </div>
          <div className="command-v2-workspace-grid command-admin-grid">
            {canManageAccounts ? (
              <section className="portal-panel command-v2-launcher command-admin-card command-admin-card--featured">
                <div className="portal-panel-heading"><div><p>Access control</p><h2>Personnel Accounts</h2></div><span>Protected</span></div>
                <p className="command-v2-compact-copy">Create accounts, issue credentials, review account state, and use authorized Sheriff testing controls.</p>
                <div className="command-v2-action-row">
                  <Link className="portal-button portal-button--primary" href="/portal/command/administration/accounts">Open account administration</Link>
                </div>
              </section>
            ) : null}

            <section className="portal-panel command-v2-launcher command-admin-card">
              <div className="portal-panel-heading"><div><p>Personnel history</p><h2>Service Records</h2></div></div>
              <p className="command-v2-compact-copy">Record and review attributed personnel actions without crowding individual personnel pages.</p>
              <div className="command-v2-action-row">
                <Link className="portal-button portal-button--secondary" href="/portal/command/service-records">Open service records</Link>
              </div>
            </section>
          </div>
        </section>

        <section className="command-admin-group">
          <div className="portal-section-heading">
            <div><p>Decision & oversight</p><h2>Review what needs Command</h2></div>
            <span>Pending decisions and the audit trail are separated from account administration.</span>
          </div>
          <div className="command-v2-workspace-grid command-admin-grid">
            <section className="portal-panel command-v2-launcher command-admin-card command-admin-card--featured">
              <div className="portal-panel-heading"><div><p>Decision queue</p><h2>Approvals</h2></div></div>
              <p className="command-v2-compact-copy">Review routed personnel requests, Guardians, leave, and qualification decisions.</p>
              <div className="command-v2-action-row">
                <Link className="portal-button portal-button--primary" href="/portal/command/approvals">Open approvals</Link>
              </div>
            </section>

            <section className="portal-panel command-v2-launcher command-admin-card">
              <div className="portal-panel-heading"><div><p>Accountability</p><h2>Activity & Audit</h2></div></div>
              <p className="command-v2-compact-copy">Review recorded portal activity and attributed personnel changes.</p>
              <div className="command-v2-action-row">
                <Link className="portal-button portal-button--secondary" href="/portal/command/activity">Open activity</Link>
              </div>
            </section>
          </div>
        </section>

        {executive ? (
          <section className="command-admin-group">
            <div className="portal-section-heading">
              <div><p>Executive configuration</p><h2>Department structure</h2></div>
              <span>Organization and authority changes are intentionally separated from routine administration.</span>
            </div>
            <section className="portal-panel command-admin-executive-card">
              <div>
                <span>Executive only</span>
                <h3>Command Structure</h3>
                <p>Manage organizational units, assignments, supervisory authority, and the department command model.</p>
              </div>
              <Link className="portal-button portal-button--secondary" href="/portal/command/administration/structure">Open structure</Link>
            </section>
          </section>
        ) : null}
      </div>
    </PortalShell>
  );
}
