import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { PersonnelRecordTabs } from "../../../../_components/PersonnelRecordTabs";
import { PortalShell } from "../../../../_components/PortalShell";
import { createClient } from "@/lib/supabase/server";
import { getCurrentPortalProfile } from "@/lib/supabase/portal-profile";

type PageProps = { params: Promise<{ personnelId: string }> };

type DocumentRow = {
  id: string;
  document_number: number;
  title: string;
  category: string;
  document_date: string | null;
  visibility: string;
  source_type: string;
  status: string;
  file_name: string;
  created_at: string;
};

export default async function PersonnelDocumentsPage({ params }: PageProps) {
  const profile = await getCurrentPortalProfile();
  if (!profile || !["Executive", "Command"].includes(profile.access_tier)) redirect("/portal/command/supervision");

  const { personnelId } = await params;
  const supabase = await createClient() as any;
  const { data: member } = await supabase
    .from("personnel_profiles")
    .select("id,personnel_id,display_name,rank,division")
    .eq("personnel_id", personnelId.toUpperCase())
    .maybeSingle();

  if (!member) notFound();

  const documents = await supabase
    .from("personnel_documents")
    .select("id,document_number,title,category,document_date,visibility,source_type,status,file_name,created_at")
    .eq("profile_id", member.id)
    .neq("status", "Removed")
    .order("document_date", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false });

  const vaultReady = !documents.error;
  const rows = (documents.data ?? []) as DocumentRow[];
  const grouped = new Map<string, DocumentRow[]>();
  for (const row of rows) {
    const current = grouped.get(row.category) ?? [];
    current.push(row);
    grouped.set(row.category, current);
  }

  return (
    <PortalShell
      active="personnel"
      eyebrow={`${member.personnel_id} · Documents`}
      title={`${member.display_name} · Document Vault`}
      description="Personnel documents and supporting records."
      actions={<Link className="portal-button portal-button--secondary" href={`/portal/command/personnel/${member.personnel_id}`}>Back to record</Link>}
    >
      <PersonnelRecordTabs personnelId={member.personnel_id} active="documents" />

      {!vaultReady ? (
        <section className="portal-panel">
          <div className="portal-panel-heading"><div><p>Document Vault</p><h2>Vault schema not active</h2></div><span>Preview</span></div>
          <div className="command-v2-inline-state">
            <strong>No production document storage has been enabled.</strong>
            <span>The V2 vault remains isolated until its authority and storage policies are approved.</span>
          </div>
        </section>
      ) : (
        <div className="command-v2-directory">
          <section className="portal-panel">
            <div className="portal-panel-heading"><div><p>Vault</p><h2>Documents on file</h2></div><span>{rows.length}</span></div>
            {rows.length ? (
              <div className="personnel-document-groups">
                {Array.from(grouped.entries()).sort(([a], [b]) => a.localeCompare(b)).map(([category, items]) => (
                  <section key={category}>
                    <div className="personnel-document-group-head"><strong>{category}</strong><span>{items.length}</span></div>
                    <div className="personnel-document-list">
                      {items.map((item) => (
                        <article key={item.id}>
                          <div>
                            <strong>{item.title}</strong>
                            <span>PD-{String(item.document_number).padStart(6, "0")} · {item.file_name}</span>
                          </div>
                          <div>
                            <strong>{item.document_date ? new Date(`${item.document_date}T12:00:00`).toLocaleDateString() : new Date(item.created_at).toLocaleDateString()}</strong>
                            <span>{item.visibility} · {item.status}</span>
                          </div>
                        </article>
                      ))}
                    </div>
                  </section>
                ))}
              </div>
            ) : <p className="command-v2-compact-copy">No documents on file.</p>}
          </section>
        </div>
      )}
    </PortalShell>
  );
}
