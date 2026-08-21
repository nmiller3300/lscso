import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { PersonnelRecordTabs } from "../../../../_components/PersonnelRecordTabs";
import { PortalShell } from "../../../../_components/PortalShell";
import { createClient } from "@/lib/supabase/server";
import { getCurrentPortalProfile } from "@/lib/supabase/portal-profile";

type PageProps = { params: Promise<{ personnelId: string }> };

const categories = [
  ["Guardians", "Guardian attachments and supporting documentation."],
  ["Evaluations", "Performance reviews and supervisory evaluations."],
  ["Training", "Training records, evaluations, and supporting files."],
  ["Certifications", "Certification documents and qualification records."],
  ["Leave / LOA", "Approved leave documentation and related records."],
  ["Disciplinary", "Authorized disciplinary supporting documents."],
  ["Administrative", "Personnel actions and administrative records."],
  ["Other", "Authorized personnel documents that do not fit another category."],
] as const;

export default async function PersonnelDocumentsPage({ params }: PageProps) {
  const profile = await getCurrentPortalProfile();
  if (!profile || !["Executive", "Command"].includes(profile.access_tier)) {
    redirect("/portal/command/supervision");
  }

  const { personnelId } = await params;
  const supabase = await createClient() as any;
  const { data: member } = await supabase
    .from("personnel_profiles")
    .select("id,personnel_id,display_name,rank,division")
    .eq("personnel_id", personnelId.toUpperCase())
    .maybeSingle();

  if (!member) notFound();

  return (
    <PortalShell
      active="personnel"
      eyebrow={`${member.personnel_id} · Documents`}
      title={`${member.display_name} · Document Vault`}
      description="Personnel documents and supporting records."
      actions={<Link className="portal-button portal-button--secondary" href={`/portal/command/personnel/${member.personnel_id}`}>Back to record</Link>}
    >
      <PersonnelRecordTabs personnelId={member.personnel_id} active="documents" />

      <section className="portal-panel">
        <div className="portal-panel-heading"><div><p>Personnel Vault</p><h2>Document storage</h2></div><span>Preview</span></div>
        <div className="command-v2-inline-state">
          <strong>Private vault storage is staged, not active.</strong>
          <span>Uploads stay disabled until the V2 authority model and storage policies are approved.</span>
        </div>
      </section>

      <div className="command-v2-workspace-grid">
        {categories.map(([category, description]) => (
          <section className="portal-panel command-v2-launcher" key={category}>
            <div className="portal-panel-heading"><div><p>Category</p><h2>{category}</h2></div><span>0</span></div>
            <p className="command-v2-compact-copy">{description}</p>
          </section>
        ))}
      </div>
    </PortalShell>
  );
}
