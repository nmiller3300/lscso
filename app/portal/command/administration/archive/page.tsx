import Link from "next/link";
import { redirect } from "next/navigation";
import { PortalShell } from "../../../_components/PortalShell";
import { getCurrentPortalProfile } from "@/lib/supabase/portal-profile";
import { ArchiveWorkspace } from "./ArchiveWorkspace";
import { loadArchiveRecords } from "./actions";
import "./archive-admin.css";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type PageProps = {
  searchParams: Promise<{ edit?: string }>;
};

export default async function AdministrationArchivePage({ searchParams }: PageProps) {
  const profile = await getCurrentPortalProfile();
  if (!profile) redirect("/portal/login");
  if (profile.rank !== "Sheriff" && profile.rank !== "Undersheriff") redirect("/portal/command/administration");

  const params = await searchParams;
  const records = await loadArchiveRecords();
  const editing = params.edit ? records.find((record: any) => record.id === params.edit) ?? null : null;

  return (
    <PortalShell
      active="administration"
      eyebrow="Administration / Department Governance"
      title="Historical Archive"
      description="Build the living Miller–White administration archive and control public historical releases."
      actions={<Link className="portal-button portal-button--secondary" href="/portal/command/administration">Back to Administration</Link>}
    >
      <ArchiveWorkspace records={records} editing={editing} />
    </PortalShell>
  );
}
