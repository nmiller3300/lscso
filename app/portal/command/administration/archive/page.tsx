import Link from "next/link";
import { redirect } from "next/navigation";
import { PortalShell } from "../../../_components/PortalShell";
import { getCurrentPortalProfile } from "@/lib/supabase/portal-profile";
import { ArchiveEditor } from "./ArchiveEditor";

export const runtime = "nodejs";

export default async function AdministrationArchivePage() {
  const profile = await getCurrentPortalProfile();
  if (!profile) redirect("/portal/login");
  if (profile.rank !== "Sheriff" && profile.rank !== "Undersheriff") redirect("/portal/command/administration");

  return (
    <PortalShell
      active="administration"
      eyebrow="Administration / Department Governance"
      title="Historical Archive"
      description="Build the living Miller–White administration archive and control public historical releases."
      actions={<Link className="portal-button portal-button--secondary" href="/portal/command/administration">Back to Administration</Link>}
    >
      <ArchiveEditor />
    </PortalShell>
  );
}
