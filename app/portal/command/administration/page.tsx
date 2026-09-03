import Link from "next/link";
import { redirect } from "next/navigation";
import { PortalShell } from "../../_components/PortalShell";
import { createClient } from "@/lib/supabase/server";
import { getCurrentPortalProfile } from "@/lib/supabase/portal-profile";

const STANDING_ACCOUNT_ADMIN = new Set(["Sheriff", "Undersheriff", "Major", "Captain"]);
type AdminTool = { href: string; code: string; eyebrow: string; title: string; description: string; badge?: string };

export default async function AdministrationWorkspacePage() {
  const profile = await getCurrentPortalProfile();
  if (!profile || !["Executive", "Command"].includes(profile.access_tier)) redirect("/portal/command/supervision");
  const executive = profile.access_tier === "Executive";
  const supabase = await createClient() as any;
  const { data: accessRows } = await supabase.rpc("get_my_roster_access");
  const delegations = new Set<string>(accessRows?.[0]?.active_delegations ?? []);
  const canManageAccounts = STANDING_ACCOUNT_ADMIN.has(profile.rank) || delegations.has("Personnel Administration") || delegations.has("Temporary Command Authority");

  const tools: AdminTool[] = [
    ...(canManageAccounts ? [{ href: "/portal/command/administration/accounts", code: "AC", eyebrow: "Personnel administration", title: "Personnel Accounts", description: "Create department accounts, issue credentials, and manage account access." }] : []),
    { href: "/portal/command/approvals", code: "AP", eyebrow: "Decision queue", title: "Approvals", description: "Review routed Guardians, personnel requests, leave, and certification actions." },
    { href: "/portal/command/activity", code: "AU", eyebrow: "Audit", title: "Activity", description: "Review recorded portal, personnel, and administrative activity." },
    { href: "/portal/command/service-records", code: "SR", eyebrow: "Personnel administration", title: "Service Records", description: "Record administrative personnel actions without crowding individual personnel pages." },
    ...(executive ? [
      { href: "/portal/command/administration/structure", code: "CS", eyebrow: "Organization", title: "Command Structure", description: "Manage units, assignments, authority, and the department command structure.", badge: "Executive" },
      { href: "/portal/command/administration/maintenance", code: "MT", eyebrow: "System operations", title: "Maintenance Center", description: "Schedule maintenance, notify users, control public and Portal availability, and restore service.", badge: "Executive" },
    ] : []),
  ];

  return <PortalShell active="administration" eyebrow="Administration" title="Administration" description="Department administration, approvals, personnel access, and organizational controls."><div className="portal-admin-layout"><section className="portal-panel portal-admin-directory"><div className="portal-panel-heading"><div><p>Department tools</p><h2>Administrative workspace</h2></div><span>{tools.length} available</span></div><p className="portal-admin-intro">Open the tool you need. Access remains controlled by your current rank, assignment, and delegated authority.</p><div className="portal-admin-tool-list">{tools.map((tool) => <Link href={tool.href} key={tool.href}><span className="portal-admin-tool-code" aria-hidden="true">{tool.code}</span><div><small>{tool.eyebrow}</small><strong>{tool.title}</strong><p>{tool.description}</p></div>{tool.badge ? <b>{tool.badge}</b> : null}<span className="portal-admin-tool-arrow" aria-hidden="true">→</span></Link>)}</div></section><aside className="portal-panel portal-admin-access-note"><div className="portal-panel-heading"><div><p>Access model</p><h2>Your authority</h2></div></div><strong>{profile.rank}</strong><span>{profile.access_tier} access</span><p>Administrative actions are permission-scoped and audited. Tools you are not authorized to use are intentionally omitted rather than shown as dead controls.</p><Link className="portal-button portal-button--secondary" href="/portal/my-office">Open My Info</Link></aside></div></PortalShell>;
}
