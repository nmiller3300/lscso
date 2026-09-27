import Link from "next/link";
import { redirect } from "next/navigation";
import { PortalShell } from "../../../_components/PortalShell";
import { getCurrentPortalProfile } from "@/lib/supabase/portal-profile";
import { AdministrationManager } from "./AdministrationManager";
import { loadAdministrationWorkspace } from "./actions";
import "./current-administration.css";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function CurrentAdministrationPage() {
  const profile = await getCurrentPortalProfile();
  if (!profile) redirect("/portal/login");
  if (!['Sheriff', 'Undersheriff'].includes(profile.rank)) redirect("/portal/command/administration");

  const { members, personnel } = await loadAdministrationWorkspace();

  return (
    <PortalShell
      active="administration"
      eyebrow="Administration / Office of the Sheriff"
      title="Current Administration"
      description="Manage the command personnel presented by the Office of the Sheriff without editing the public website by hand."
      actions={<>
        <Link className="portal-button portal-button--secondary" href="/office-of-the-sheriff" target="_blank">View public page</Link>
        <Link className="portal-button portal-button--secondary" href="/portal/command/administration">Back to Administration</Link>
      </>}
    >
      <AdministrationManager members={members as any} personnel={personnel as any} />
    </PortalShell>
  );
}
