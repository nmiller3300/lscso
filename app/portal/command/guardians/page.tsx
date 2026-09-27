import { GuardianDirectory } from "../../_components/GuardianDirectory";
import { GuardianReferenceNotice } from "../../_components/GuardianReferenceNotice";
import { GuardianWorkspace } from "../../_components/GuardianWorkspace";
import { PortalShell } from "../../_components/PortalShell";
import { createClient } from "@/lib/supabase/server";

type GuardianDirectoryPerson = {
  id: string;
  personnel_id: string;
  display_name: string;
};

type PageProps = {
  searchParams: Promise<{ q?: string }>;
};

export default async function GuardianCenterPage({ searchParams }: PageProps) {
  const supabase = await createClient() as any;
  const [{ data: guardians }, { data: personnel }, params] = await Promise.all([
    supabase.from("guardian_records")
      .select("id,guardian_number,reference_number,record_type,status,title,subject_profile_id,author_profile_id,created_at,follow_up_due_at,structured_fields")
      .order("created_at", { ascending: false }),
    supabase.from("personnel_profiles").select("id,personnel_id,display_name"),
    searchParams,
  ]);

  const names = new Map<string, GuardianDirectoryPerson>(
    ((personnel ?? []) as GuardianDirectoryPerson[]).map((member) => [member.id, member]),
  );
  const visibleGuardians = (guardians ?? []).filter((record: any) => record.structured_fields?.lifecycle_state !== "Scheduled");

  return (
    <PortalShell
      active="guardians"
      eyebrow="Guardian Workspace"
      title="Guardians"
      description="Create authorized Guardian actions, review routed records, and search the Guardian history from one workspace."
    >
      <GuardianReferenceNotice />
      <GuardianWorkspace />

      <section className="portal-panel" aria-labelledby="guardian-record-directory-title">
        <div className="portal-panel-heading">
          <div>
            <p>Guardian records</p>
            <h2 id="guardian-record-directory-title">Search existing records</h2>
          </div>
        </div>
        <GuardianDirectory initialQuery={params.q?.slice(0, 120) ?? ""} records={visibleGuardians.map((record:any) => ({
          id: record.id,
          guardianNumber: Number(record.guardian_number),
          referenceNumber: record.reference_number,
          recordType: record.record_type,
          status: record.status,
          title: record.title,
          subjectName: names.get(record.subject_profile_id)?.display_name ?? "Restricted personnel",
          subjectPersonnelId: names.get(record.subject_profile_id)?.personnel_id ?? "",
          authorName: names.get(record.author_profile_id)?.display_name ?? "Command",
          createdAt: record.created_at,
          followUpDueAt: record.follow_up_due_at,
        }))} />
      </section>
    </PortalShell>
  );
}
