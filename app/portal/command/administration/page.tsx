import Link from "next/link";
import { redirect } from "next/navigation";
import { PortalShell } from "../../_components/PortalShell";
import { createClient } from "@/lib/supabase/server";
import { getCurrentPortalProfile } from "@/lib/supabase/portal-profile";

const STANDING_ACCOUNT_ADMIN = new Set(["Sheriff", "Undersheriff", "Major", "Captain"]);
type AdminTool = { href: string; code: string; eyebrow: string; title: string; description: string; badge?: string; group: "Personnel Administration" | "Department Governance" };

export default async function AdministrationWorkspacePage() {
  const profile = await getCurrentPortalProfile();
  if (!profile || !["Executive", "Command"].includes(profile.access_tier)) redirect("/portal/command/supervision");
  const executive = profile.access_tier === "Executive";
  const supabase = await createClient() as any;
  const { data: accessRows } = await supabase.rpc("get_my_roster_access");
  const delegations = new Set<string>(accessRows?.[0]?.active_delegations ?? []);
  const canManageAccounts = STANDING_ACCOUNT_ADMIN.has(profile.rank) || delegations.has("Personnel Administration") || delegations.has("Temporary Command Authority");

  const tools: AdminTool[] = [
    ...(canManageAccounts ? [{ href: "/portal/command/administration/accounts", code: "AC", eyebrow: "Accounts & access", title: "Personnel Accounts", description: "Create department accounts, issue credentials, and manage account access.", group: "Personnel Administration" as const }] : []),
    { href: "/portal/command/service-records", code: "SR", eyebrow: "Personnel actions", title: "Service Records", description: "Record administrative personnel actions and preserve the official service history.", group: "Personnel Administration" },
    { href: "/portal/command/activity", code: "AU", eyebrow: "Audit & accountability", title: "Activity & Audit", description: "Review recorded portal, personnel, and administrative activity.", group: "Department Governance" },
    ...(executive ? [
      { href: "/portal/command/administration/structure", code: "CS", eyebrow: "Organization", title: "Command Structure", description: "Manage units, assignments, authority, and the department command structure.", badge: "Executive", group: "Department Governance" as const },
      { href: "/portal/command/administration/maintenance", code: "MT", eyebrow: "System operations", title: "Maintenance Center", description: "Control public and Portal availability, schedule maintenance, notify users, and restore service.", badge: "Executive", group: "Department Governance" as const },
    ] : []),
  ];

  const groups: AdminTool["group"][] = ["Personnel Administration", "Department Governance"];

  return (
    <PortalShell
      active="administration"
      eyebrow="Administration"
      title="Administration"
      description="Accounts, official service actions, audit, organizational structure, and protected system controls."
      actions={<Link className="portal-button portal-button--primary" href="/portal/command/approvals">Open Approvals & Requests</Link>}
    >
      <div className="portal-admin-layout">
        <section className="portal-panel portal-admin-directory">
          <div className="portal-panel-heading"><div><p>Department administration</p><h2>Administrative workspace</h2></div><span>{tools.length} tools</span></div>
          <p className="portal-admin-intro">Daily decisions live in Approvals & Requests. This page is reserved for administration that changes accounts, official records, organizational structure, or the system itself.</p>
          {groups.map((group) => {
            const groupTools = tools.filter((tool) => tool.group === group);
            if (!groupTools.length) return null;
            return (
              <div key={group} style={{ marginTop: 22 }}>
                <p className="eyebrow" style={{ marginBottom: 10 }}>{group}</p>
                <div className="portal-admin-tool-list">
                  {groupTools.map((tool) => (
                    <Link href={tool.href} key={tool.href}>
                      <span className="portal-admin-tool-code" aria-hidden="true">{tool.code}</span>
                      <div><small>{tool.eyebrow}</small><strong>{tool.title}</strong><p>{tool.description}</p></div>
                      {tool.badge ? <b>{tool.badge}</b> : null}
                      <span className="portal-admin-tool-arrow" aria-hidden="true">→</span>
                    </Link>
                  ))}
                </div>
              </div>
            );
          })}
        </section>
        <aside className="portal-panel portal-admin-access-note">
          <div className="portal-panel-heading"><div><p>Access model</p><h2>Your authority</h2></div></div>
          <strong>{profile.rank}</strong><span>{profile.access_tier} access</span>
          <p>Administrative actions remain permission-scoped and audited. Tools you are not authorized to use are omitted instead of shown as dead controls.</p>
          <Link className="portal-button portal-button--secondary" href="/portal/my-office">Open My Info</Link>
        </aside>
      </div>
    </PortalShell>
  );
}
